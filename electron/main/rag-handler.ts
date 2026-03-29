/**
 * RAG Handler — Main Process
 *
 * 架构说明：
 * - 在 Electron 主进程（Node.js）中运行，彻底规避渲染进程 file:// 协议限制
 * - 使用 SHA-256 内容哈希作为缓存键，书籍移动/重命名不会导致缓存失效
 * - 缓存存储在 app.getPath('userData')/rag-cache/{contentHash}.json
 * - 超大书籍（>SEMANTIC_FULL_THRESHOLD chunks）采用两阶段索引：
 *   阶段 1：立即建立词法索引（<1s），书籍即刻可用
 *   阶段 2：后台语义采样升级（进度通过 rag:upgrade-progress 推送）
 * - 混合模式（hybrid）：语义采样 + 全量词法，RRF 融合检索结果
 */

import path from 'node:path'
import fsAsync from 'node:fs/promises'
import crypto from 'node:crypto'
import { app } from 'electron'
import type { WebContents } from 'electron'
import { create, insert, search as oramaSearch } from '@orama/orama'
import type { AnyOrama } from '@orama/orama'

// ============================================================
// Types
// ============================================================

export interface RagParagraph {
  index: number
  text: string
  offset: number
}

export interface RagSearchResult {
  text: string
  paragraphIndex: number
  offset: number
  score: number
}

interface RagChunk {
  text: string
  paragraphIndex: number
  offset: number
  embedding?: number[]
  isSemanticSampled: boolean
}

interface CacheFile {
  version: number
  contentHash: string
  mode: 'semantic' | 'lexical' | 'hybrid'
  chunkCount: number
  chunks: RagChunk[]
}

// ============================================================
// Constants
// ============================================================

const CACHE_VERSION = 3
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
const BATCH_SIZE = 32
const MAX_ORAMA_CACHE = 5
/** 超过此 chunk 数量的书籍使用两阶段索引（立即词法 + 后台语义升级） */
const SEMANTIC_FULL_THRESHOLD = 5000
/** 后台语义升级最多采样的 chunk 数（采样覆盖全书范围） */
const MAX_SEMANTIC_CHUNKS = 10000
/** Reciprocal Rank Fusion 参数，60 为学术标准默认值 */
const RRF_K = 60

// ============================================================
// Module-level state
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingPipeline: any = null
let semanticAvailable: boolean | null = null

const memoryCache = new Map<string, CacheFile>()
const oramaIndexCache = new Map<string, AnyOrama>()
/** Prevents concurrent ragIngest calls for the same content from running in parallel */
const inFlightByHash = new Set<string>()

// ============================================================
// Path helpers
// ============================================================

function getCacheDir(): string {
  return path.join(app.getPath('userData'), 'rag-cache')
}

function getCachePath(contentHash: string): string {
  return path.join(getCacheDir(), `${contentHash}.json`)
}

function getResourceRoot(): string {
  return app.isPackaged ? process.resourcesPath : process.cwd()
}

// ============================================================
// Adaptive chunk size (分段非线性，按书籍规模自动调整)
// ============================================================

/**
 * 根据书籍总字符数返回合适的 chunkSize 和 chunkOverlap。
 *
 * 分段规则：
 *   < 200,000 chars     → 500   (短文/短篇)
 *   200k – 2M chars     → 1000  (中长篇小说)
 *   2M – 10M chars      → 2000  (长篇小说)
 *   ≥ 10M chars         → 4000  (超长网文)
 *   clamp: [500, 8000]
 *   overlap = max(50, chunkSize × 10%)
 */
export function adaptiveChunkSize(totalChars: number): { chunkSize: number; chunkOverlap: number } {
  let chunkSize: number
  if (totalChars < 200_000) {
    chunkSize = 500
  } else if (totalChars < 2_000_000) {
    chunkSize = 1_000
  } else if (totalChars < 10_000_000) {
    chunkSize = 2_000
  } else {
    chunkSize = 4_000
  }
  chunkSize = Math.min(Math.max(chunkSize, 500), 8_000)
  const chunkOverlap = Math.max(50, Math.floor(chunkSize * 0.1))
  return { chunkSize, chunkOverlap }
}

// ============================================================
// Text chunking (inline — no langchain dependency)
// ============================================================

function chunkParagraphs(
  paragraphs: RagParagraph[],
  chunkSize: number,
  chunkOverlap: number,
): RagChunk[] {
  const chunks: RagChunk[] = []
  const separators = ['\n\n', '\n', '。', '！', '？', ' ']

  for (const para of paragraphs) {
    const text = para.text.trim()
    if (!text) continue

    if (text.length <= chunkSize) {
      chunks.push({ text, paragraphIndex: para.index, offset: 0, isSemanticSampled: false })
      continue
    }

    // Recursively split by separators until segments fit within chunkSize
    let segments: string[] = [text]
    for (const sep of separators) {
      const next: string[] = []
      for (const seg of segments) {
        if (seg.length > chunkSize) {
          next.push(...seg.split(sep).filter(Boolean))
        } else {
          next.push(seg)
        }
      }
      segments = next
      if (segments.every((s) => s.length <= chunkSize)) break
    }

    // Merge segments into chunks with overlap
    let currentChunk = ''
    let currentOffset = 0

    for (const seg of segments) {
      if (currentChunk.length + seg.length <= chunkSize) {
        currentChunk += seg
      } else {
        if (currentChunk) {
          chunks.push({ text: currentChunk, paragraphIndex: para.index, offset: currentOffset, isSemanticSampled: false })
          const overlapStart = Math.max(0, currentChunk.length - chunkOverlap)
          currentOffset += overlapStart
          currentChunk = currentChunk.slice(overlapStart) + seg
        } else {
          // Segment itself exceeds chunkSize — hard split
          for (let i = 0; i < seg.length; i += chunkSize - chunkOverlap) {
            chunks.push({
              text: seg.slice(i, i + chunkSize),
              paragraphIndex: para.index,
              offset: currentOffset + i,
              isSemanticSampled: false,
            })
          }
          currentOffset += seg.length
          currentChunk = ''
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({ text: currentChunk, paragraphIndex: para.index, offset: currentOffset, isSemanticSampled: false })
    }
  }

  return chunks
}

// ============================================================
// Semantic sampling (头/尾/均匀间隔，覆盖全书范围)
// ============================================================

/**
 * 从全量 chunks 中采样 ≤ maxSemantic 个用于语义 embedding。
 * 修改 chunks[].isSemanticSampled 字段（in-place），返回被采样的 chunk 子集。
 *
 * 策略：
 *   - 头段 min(2000, total×15%) 个 chunk（人物/世界观，最重要）
 *   - 尾段 min(2000, total×15%) 个 chunk（结局）
 *   - 中间段均匀间隔采样，总量控制在 maxSemantic 以内
 */
function sampleChunks(chunks: RagChunk[], maxSemantic: number): RagChunk[] {
  const total = chunks.length

  if (total <= maxSemantic) {
    chunks.forEach((c) => (c.isSemanticSampled = true))
    return chunks
  }

  const headCount = Math.min(2000, Math.floor(total * 0.15))
  const tailCount = Math.min(2000, Math.floor(total * 0.15))
  const midTarget = Math.max(0, maxSemantic - headCount - tailCount)

  const headChunks = chunks.slice(0, headCount)
  const tailChunks = chunks.slice(total - tailCount)
  const midChunks = chunks.slice(headCount, total - tailCount)

  const step = Math.max(1, Math.floor(midChunks.length / midTarget))
  const sampledMid = midChunks.filter((_, i) => i % step === 0)

  // Use Set to guarantee uniqueness (head/tail could overlap for very small books)
  const sampledSet = new Set([...headChunks, ...sampledMid, ...tailChunks])

  chunks.forEach((c) => (c.isSemanticSampled = sampledSet.has(c)))
  return [...sampledSet]
}

// ============================================================
// Content hash (书籍内容指纹，与文件路径无关)
// ============================================================

export function computeContentHash(paragraphs: RagParagraph[]): string {
  const content = paragraphs.map((p) => p.text).join('\n')
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
}

// ============================================================
// Embedding model (graceful fallback to lexical)
// ============================================================

async function tryLoadEmbeddingModel(): Promise<boolean> {
  if (semanticAvailable === true) return true
  if (semanticAvailable === false) return false

  try {
    const { pipeline, env } = await import('@huggingface/transformers')
    const resourceRoot = getResourceRoot()
    const modelRoot = path.join(resourceRoot, 'resources', 'models')
    const ortRoot = path.join(resourceRoot, 'resources', 'ort')

    env.allowLocalModels = true
    env.allowRemoteModels = false
    env.localModelPath = modelRoot
    env.useBrowserCache = false

    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.wasmPaths = ortRoot + path.sep
    }

    console.log('[RAG] Loading embedding model from:', modelRoot)
    embeddingPipeline = await pipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
      local_files_only: true,
    })

    semanticAvailable = true
    console.log('[RAG] Embedding model loaded successfully')
    return true
  } catch (error) {
    console.warn('[RAG] Semantic model unavailable, using lexical search:', error)
    semanticAvailable = false
    embeddingPipeline = null
    return false
  }
}

async function computeEmbeddings(texts: string[]): Promise<number[][]> {
  if (!embeddingPipeline) throw new Error('Embedding pipeline not loaded')
  const output = await embeddingPipeline(texts, { pooling: 'mean', normalize: true })
  return output.tolist() as number[][]
}

// ============================================================
// Cache I/O
// ============================================================

async function loadCache(contentHash: string): Promise<CacheFile | null> {
  if (memoryCache.has(contentHash)) return memoryCache.get(contentHash)!
  try {
    const raw = await fsAsync.readFile(getCachePath(contentHash), 'utf-8')
    const data = JSON.parse(raw) as CacheFile
    if (data.version !== CACHE_VERSION) {
      // Evict stale-version cache and re-index from scratch
      console.log(`[RAG] Evicted stale cache v${data.version} → v${CACHE_VERSION}: ${contentHash.slice(0, 8)}`)
      await fsAsync.unlink(getCachePath(contentHash)).catch(() => {})
      return null
    }
    memoryCache.set(contentHash, data)
    return data
  } catch {
    return null
  }
}

async function saveCache(data: CacheFile): Promise<void> {
  await fsAsync.mkdir(getCacheDir(), { recursive: true })
  await fsAsync.writeFile(getCachePath(data.contentHash), JSON.stringify(data), 'utf-8')
  memoryCache.set(data.contentHash, data)
}

// ============================================================
// Orama lexical index (lazy build, LRU eviction)
// ============================================================

async function getOrBuildOramaIndex(cacheData: CacheFile): Promise<AnyOrama> {
  const key = cacheData.contentHash
  if (oramaIndexCache.has(key)) return oramaIndexCache.get(key)!

  const db = await create({
    schema: {
      text: 'string' as const,
      paragraphIndex: 'number' as const,
      offset: 'number' as const,
    },
  })

  for (const chunk of cacheData.chunks) {
    await insert(db, {
      text: chunk.text,
      paragraphIndex: chunk.paragraphIndex,
      offset: chunk.offset,
    })
  }

  if (oramaIndexCache.size >= MAX_ORAMA_CACHE) {
    const firstKey = oramaIndexCache.keys().next().value
    if (firstKey) oramaIndexCache.delete(firstKey)
  }
  oramaIndexCache.set(key, db)
  return db
}

// ============================================================
// Cosine similarity (semantic search scoring)
// ============================================================

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// ============================================================
// Hybrid search (语义采样 + 全量词法 → RRF 融合)
// ============================================================

async function hybridSearch(
  cache: CacheFile,
  query: string,
  topK: number,
): Promise<RagSearchResult[]> {
  type ScoredChunk = { key: string; chunk: RagChunk; score: number }
  const scoreMap = new Map<string, ScoredChunk>()

  const chunkKey = (c: RagChunk) => `${c.paragraphIndex}:${c.offset}`

  // --- Semantic path (sampled chunks with embeddings) ---
  try {
    const isReady = await tryLoadEmbeddingModel()
    if (isReady && embeddingPipeline) {
      const [queryEmb] = await computeEmbeddings([query])
      const semanticTopK = topK * 2

      cache.chunks
        .filter((c): c is RagChunk & { embedding: number[] } => Boolean(c.embedding))
        .map((c) => ({ c, score: cosine(queryEmb, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, semanticTopK)
        .forEach(({ c }, rank) => {
          const key = chunkKey(c)
          const contribution = 1 / (RRF_K + rank + 1)
          const existing = scoreMap.get(key)
          if (existing) {
            existing.score += contribution
          } else {
            scoreMap.set(key, { key, chunk: c, score: contribution })
          }
        })
    }
  } catch (err) {
    console.warn('[RAG] Hybrid semantic path failed, using lexical only:', err)
  }

  // --- Lexical path (full chunk set via Orama BM25) ---
  try {
    const db = await getOrBuildOramaIndex(cache)
    const lexicalTopK = topK * 2
    const lexicalRaw = await oramaSearch(db, {
      term: query,
      properties: ['text'],
      limit: lexicalTopK,
    })

    lexicalRaw.hits.forEach((hit, rank) => {
      const pIdx = hit.document.paragraphIndex as number
      const offset = (hit.document.offset as number) ?? 0
      const text = hit.document.text as string

      // Look up original chunk for metadata consistency
      const originalChunk = cache.chunks.find(
        (c) => c.paragraphIndex === pIdx && c.offset === offset,
      )
      const chunk: RagChunk = originalChunk ?? {
        text,
        paragraphIndex: pIdx,
        offset,
        isSemanticSampled: false,
      }
      const key = chunkKey(chunk)
      const contribution = 1 / (RRF_K + rank + 1)
      const existing = scoreMap.get(key)
      if (existing) {
        existing.score += contribution
      } else {
        scoreMap.set(key, { key, chunk, score: contribution })
      }
    })
  } catch (err) {
    console.warn('[RAG] Hybrid lexical path failed:', err)
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => ({
      text: chunk.text,
      paragraphIndex: chunk.paragraphIndex,
      offset: chunk.offset,
      score,
    }))
}

// ============================================================
// Background semantic upgrade (with progress events)
// ============================================================

/**
 * 后台将词法缓存升级为混合缓存（hybrid）。
 * 使用语义采样减少 embedding 总量，进度通过 rag:upgrade-progress 事件推送。
 * 完成后发送 rag:upgrade-complete 并更新磁盘/内存缓存。
 */
async function backgroundReindexSemantic(
  bookId: string,
  paragraphs: RagParagraph[],
  contentHash: string,
  sender: WebContents,
  signal?: AbortSignal,
): Promise<void> {
  const safeSend = (channel: string, payload: unknown) => {
    try {
      if (!sender.isDestroyed()) sender.send(channel, payload)
    } catch {
      // window may have been closed
    }
  }

  console.log(`[RAG] Background semantic upgrade started: ${bookId}`)
  const totalChars = paragraphs.reduce((sum, p) => sum + p.text.length, 0)
  const { chunkSize, chunkOverlap } = adaptiveChunkSize(totalChars)
  const chunks = chunkParagraphs(paragraphs, chunkSize, chunkOverlap)
  const sampledChunks = sampleChunks(chunks, MAX_SEMANTIC_CHUNKS)

  let processed = 0
  for (let i = 0; i < sampledChunks.length; i += BATCH_SIZE) {
    if (signal?.aborted) {
      console.log('[RAG] Background semantic upgrade cancelled')
      return
    }
    const batch = sampledChunks.slice(i, i + BATCH_SIZE)
    try {
      const embeddings = await computeEmbeddings(batch.map((c) => c.text))
      for (let j = 0; j < batch.length; j++) {
        if (embeddings[j]) batch[j].embedding = embeddings[j]
      }
    } catch (err) {
      console.error('[RAG] Background embedding error:', err)
      return
    }
    processed += batch.length
    const progress = Math.round((processed / sampledChunks.length) * 95)
    safeSend('rag:upgrade-progress', { bookId, progress })
  }

  if (sampledChunks.some((c) => c.embedding)) {
    await saveCache({
      version: CACHE_VERSION,
      contentHash,
      mode: 'hybrid',
      chunkCount: chunks.length,
      chunks,
    })
    // Invalidate Orama lexical index so next search rebuilds from hybrid cache
    oramaIndexCache.delete(contentHash)
    safeSend('rag:upgrade-progress', { bookId, progress: 100 })
    safeSend('rag:upgrade-complete', { bookId, chunkCount: chunks.length })
    console.log(
      `[RAG] Background semantic upgrade complete: ${bookId} | sampled=${sampledChunks.length}/${chunks.length}`,
    )
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * 对书籍段落进行向量化索引，结果写入 userData/rag-cache/{contentHash}.json
 * 通过 sender 推送进度/完成事件到渲染进程。
 *
 * 两阶段策略（大书）：
 *   Phase 1: 立即建立词法索引（<1s），发送 ingest-complete，书籍即刻可用
 *   Phase 2: 后台语义采样升级，进度通过 rag:upgrade-progress 推送
 *
 * 单阶段策略（小书，chunks ≤ SEMANTIC_FULL_THRESHOLD）：
 *   全量语义 embedding，行为与原来一致
 */
export async function ragIngest(
  bookId: string,
  paragraphs: RagParagraph[],
  sender: WebContents,
  signal?: AbortSignal,
): Promise<{ contentHash: string; chunkCount: number }> {
  if (paragraphs.length === 0) {
    sender.send('rag:ingest-complete', { bookId, contentHash: '', chunkCount: 0, mode: 'lexical' })
    return { contentHash: '', chunkCount: 0 }
  }

  const contentHash = computeContentHash(paragraphs)

  // Concurrent deduplication: if this exact content is already being indexed,
  // drop the duplicate request.  The original call will fire rag:ingest-complete
  // when done; there is no need to start a second identical pipeline.
  if (inFlightByHash.has(contentHash)) {
    console.log(`[RAG] Duplicate ingest ignored (already in-flight): ${bookId} hash=${contentHash.slice(0, 8)}`)
    return { contentHash, chunkCount: 0 }
  }

  // Cache hit: validate mode before reusing
  const cached = await loadCache(contentHash)
  if (cached) {
    if (cached.mode === 'lexical') {
      const semanticNowAvailable = await tryLoadEmbeddingModel()
      if (semanticNowAvailable) {
        // Stale lexical cache: mark ready immediately, upgrade silently in background
        console.log(`[RAG] Stale lexical cache for ${bookId} — ready now, upgrading in background`)
        sender.send('rag:ingest-progress', { bookId, progress: 100 })
        sender.send('rag:ingest-complete', { bookId, contentHash, chunkCount: cached.chunkCount, mode: 'lexical' })
        setImmediate(() => {
          backgroundReindexSemantic(bookId, paragraphs, contentHash, sender, signal).catch((err) => {
            console.error('[RAG] Background semantic reindex failed:', err)
          })
        })
        return { contentHash, chunkCount: cached.chunkCount }
      }
    }
    // Valid cache (semantic, hybrid, or lexical when semantic unavailable) — use as-is
    console.log(`[RAG] Cache hit (${cached.mode}): ${bookId} hash=${contentHash.slice(0, 8)}`)
    sender.send('rag:ingest-progress', { bookId, progress: 100 })
    sender.send('rag:ingest-complete', { bookId, contentHash, chunkCount: cached.chunkCount, mode: cached.mode })
    return { contentHash, chunkCount: cached.chunkCount }
  }

  // No cache: register as in-flight before starting real work
  inFlightByHash.add(contentHash)

  try {
    // Compute adaptive chunk size
    const totalChars = paragraphs.reduce((sum, p) => sum + p.text.length, 0)
    const { chunkSize, chunkOverlap } = adaptiveChunkSize(totalChars)

    sender.send('rag:ingest-progress', { bookId, progress: 0 })
    const chunks = chunkParagraphs(paragraphs, chunkSize, chunkOverlap)
    sender.send('rag:ingest-progress', { bookId, progress: 5 })

    // ── Large book: two-phase indexing ─────────────────────────
    if (chunks.length > SEMANTIC_FULL_THRESHOLD) {
      console.log(
        `[RAG] Large book (${chunks.length} chunks > ${SEMANTIC_FULL_THRESHOLD}) — building lexical index immediately`,
      )
      await saveCache({ version: CACHE_VERSION, contentHash, mode: 'lexical', chunkCount: chunks.length, chunks })
      sender.send('rag:ingest-progress', { bookId, progress: 100 })
      sender.send('rag:ingest-complete', { bookId, contentHash, chunkCount: chunks.length, mode: 'lexical' })
      console.log(`[RAG] Lexical index ready: ${bookId} | chunks=${chunks.length}`)

      // Kick off background semantic upgrade if model is available
      const semanticAvail = await tryLoadEmbeddingModel()
      if (semanticAvail) {
        setImmediate(() => {
          backgroundReindexSemantic(bookId, paragraphs, contentHash, sender, signal).catch((err) => {
            console.error('[RAG] Background semantic reindex failed:', err)
          })
        })
      }
      return { contentHash, chunkCount: chunks.length }
    }

    // ── Small book: full semantic (original flow) ───────────────
    let mode: 'semantic' | 'lexical' = 'lexical'
    const useSemanticMode = await tryLoadEmbeddingModel()

    if (useSemanticMode) {
      let embeddingFailed = false
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        if (signal?.aborted) throw new Error('Cancelled')
        if (embeddingFailed) break
        const batch = chunks.slice(i, i + BATCH_SIZE)
        try {
          const embeddings = await computeEmbeddings(batch.map((c) => c.text))
          for (let j = 0; j < batch.length; j++) {
            if (embeddings[j]) {
              batch[j].embedding = embeddings[j]
              batch[j].isSemanticSampled = true
            }
          }
        } catch (err) {
          console.error('[RAG] Embedding batch failed:', err)
          for (const chunk of chunks) { delete chunk.embedding }
          embeddingFailed = true
          semanticAvailable = false
        }
        const progress = Math.round(10 + ((i + batch.length) / chunks.length) * 85)
        sender.send('rag:ingest-progress', { bookId, progress: Math.min(progress, 95) })
      }
      if (!embeddingFailed && chunks.some((c) => c.embedding)) {
        mode = 'semantic'
      }
    }

    await saveCache({ version: CACHE_VERSION, contentHash, mode, chunkCount: chunks.length, chunks })
    sender.send('rag:ingest-progress', { bookId, progress: 100 })
    sender.send('rag:ingest-complete', { bookId, contentHash, chunkCount: chunks.length, mode })
    console.log(`[RAG] Indexed: ${bookId} | mode=${mode} | chunks=${chunks.length}`)
    return { contentHash, chunkCount: chunks.length }
  } finally {
    inFlightByHash.delete(contentHash)
  }
}

/**
 * 检索与 query 最相关的片段。
 * - semantic: 纯余弦相似度检索
 * - lexical:  Orama BM25 词法检索
 * - hybrid:   语义采样子集 + 全量词法，RRF 融合排名
 */
export async function ragSearch(
  contentHash: string,
  query: string,
  topK = 5,
): Promise<RagSearchResult[]> {
  if (!contentHash) return []

  const cached = await loadCache(contentHash)
  if (!cached) return []

  // Hybrid mode: RRF fusion of semantic (sampled) + lexical (full)
  if (cached.mode === 'hybrid') {
    return hybridSearch(cached, query, topK)
  }

  // Semantic mode: cosine similarity on embeddings
  if (cached.mode === 'semantic' && cached.chunks.some((c) => c.embedding)) {
    try {
      const isReady = await tryLoadEmbeddingModel()
      if (isReady && embeddingPipeline) {
        const [queryEmb] = await computeEmbeddings([query])
        return cached.chunks
          .filter((c): c is RagChunk & { embedding: number[] } => Boolean(c.embedding))
          .map((c) => ({
            text: c.text,
            paragraphIndex: c.paragraphIndex,
            offset: c.offset,
            score: cosine(queryEmb, c.embedding),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
      }
    } catch (err) {
      console.warn('[RAG] Semantic search failed, falling back to lexical:', err)
    }
  }

  // Lexical mode (or semantic fallback)
  const db = await getOrBuildOramaIndex(cached)
  const results = await oramaSearch(db, {
    term: query,
    properties: ['text'],
    limit: topK,
  })

  return results.hits.map((hit) => ({
    text: hit.document.text as string,
    paragraphIndex: hit.document.paragraphIndex as number,
    offset: (hit.document.offset as number) ?? 0,
    score: hit.score ?? 0,
  }))
}

/**
 * 检查指定内容哈希的索引是否已存在（内存缓存 or 磁盘缓存）
 */
export async function ragStatus(contentHash: string): Promise<boolean> {
  if (!contentHash) return false
  if (memoryCache.has(contentHash)) return true
  try {
    await fsAsync.access(getCachePath(contentHash))
    return true
  } catch {
    return false
  }
}

/**
 * 清除指定内容哈希的缓存（内存 + 磁盘）
 */
export async function ragClearCache(contentHash: string): Promise<void> {
  memoryCache.delete(contentHash)
  oramaIndexCache.delete(contentHash)
  try {
    await fsAsync.unlink(getCachePath(contentHash))
  } catch {
    // ignore if not found
  }
}
