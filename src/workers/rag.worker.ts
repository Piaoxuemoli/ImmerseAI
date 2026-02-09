// ============================================
// RAG Worker 入口文件
// 运行在 Web Worker 中，负责 Embedding、索引、消息分发
// ============================================

import { pipeline, env } from '@xenova/transformers'
import { create, insert, search } from '@orama/orama'
import type { AnyOrama } from '@orama/orama'
import { persist, restore } from '@orama/plugin-data-persistence'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import type { WorkerMessage, WorkerResponse, Chapter, SearchResult } from './rag-types'

// 配置：允许本地模型缓存
env.allowLocalModels = true

// ---- Types ----

/** Orama 实例类型 */
type OramaDB = AnyOrama

// ---- Embedding 模型单例 ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingPipeline: any = null

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('[RAG Worker] Loading embedding model (first time only)...')
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true },
    )
    console.log('[RAG Worker] Model loaded')
  }
  return embeddingPipeline
}

/** 对文本数组生成 384 维向量 */
async function embed(texts: string[]): Promise<number[][]> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const extractor = await getEmbeddingPipeline()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const output = await extractor(texts, {
    pooling: 'mean',
    normalize: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  return output.tolist() as number[][]
}

// ---- IndexedDB 辅助函数 ----

const IDB_NAME = 'immerseai-rag'
const IDB_STORE = 'indexes'
const IDB_VERSION = 1

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveToIndexedDB(key: string, data: string): Promise<void> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(data, key)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

async function loadFromIndexedDB(key: string): Promise<string | null> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const request = tx.objectStore(IDB_STORE).get(key)
    request.onsuccess = () => {
      db.close()
      resolve((request.result as string) ?? null)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

async function existsInIndexedDB(key: string): Promise<boolean> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const request = tx.objectStore(IDB_STORE).count(key)
    request.onsuccess = () => {
      db.close()
      resolve(request.result > 0)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

// ---- Orama 索引管理 ----

const bookIndexes = new Map<string, OramaDB>()

async function createBookIndex(): Promise<OramaDB> {
  return create({
    schema: {
      text: 'string' as const,
      chapter: 'string' as const,
      cfi: 'string' as const,
      embedding: 'vector[384]' as const,
    },
  })
}

async function restoreBookIndex(bookId: string): Promise<boolean> {
  const key = `book_${bookId}`
  const data = await loadFromIndexedDB(key)
  if (!data) return false
  try {
    const db = await restore('json', data)
    bookIndexes.set(bookId, db as OramaDB)
    return true
  } catch (error) {
    console.error(`[RAG Worker] Failed to restore index for ${bookId}:`, error)
    return false
  }
}

// ---- 文本切分 ----

async function splitChapters(
  chapters: Chapter[],
): Promise<Array<{ text: string; chapter: string; cfi: string }>> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
    separators: ['\n\n', '\n', '。', ' '],
  })

  const allChunks: Array<{ text: string; chapter: string; cfi: string }> = []

  for (const ch of chapters) {
    const texts = await splitter.splitText(ch.text)
    for (const text of texts) {
      allChunks.push({
        text,
        chapter: ch.title,
        cfi: ch.cfi,
      })
    }
  }

  return allChunks
}

// ---- Ingest Pipeline ----

async function handleIngest(bookId: string, chapters: Chapter[]): Promise<void> {
  // 空章节快速路径
  if (chapters.length === 0) {
    reply({ type: 'ingest:complete', bookId, chunkCount: 0 })
    return
  }

  // Step 1: 切分
  const chunks = await splitChapters(chapters)

  // Step 2: 创建新索引（覆盖旧索引）
  if (bookIndexes.has(bookId)) {
    bookIndexes.delete(bookId)
  }
  const db = await createBookIndex()

  // Step 3: 发送初始进度
  reply({ type: 'ingest:progress', bookId, progress: 0 })

  // Step 4: 批量向量化 + 插入 Orama
  const totalChunks = chunks.length
  let processed = 0
  let lastReportedProgress = 0
  const BATCH_SIZE = 32

  for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const batchTexts = batch.map((c) => c.text)

    // 批量向量化
    const embeddings = await embed(batchTexts)

    // 逐条插入 Orama
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      const vector = embeddings[j]
      if (chunk && vector) {
        await insert(db, {
          text: chunk.text,
          chapter: chunk.chapter,
          cfi: chunk.cfi,
          embedding: vector,
        })
      }
    }

    processed += batch.length

    // 进度上报（变化 ≥ 10% 时发送）
    const currentProgress = Math.floor((processed / totalChunks) * 100)
    if (currentProgress - lastReportedProgress >= 10) {
      reply({ type: 'ingest:progress', bookId, progress: currentProgress })
      lastReportedProgress = currentProgress
    }
  }

  // Step 5: 确保发送 100% 进度
  if (lastReportedProgress < 100) {
    reply({ type: 'ingest:progress', bookId, progress: 100 })
  }

  // Step 6: 存入内存 Map
  bookIndexes.set(bookId, db)

  // Step 7: 持久化到 IndexedDB
  const serialized = await persist(db, 'json')
  await saveToIndexedDB(`book_${bookId}`, serialized as string)

  // Step 8: 完成消息
  reply({ type: 'ingest:complete', bookId, chunkCount: totalChunks })
}

// ---- Search Pipeline ----

async function handleSearch(bookId: string, query: string, topK: number, requestId?: string): Promise<void> {
  // Step 1: 获取索引 — 内存优先，IndexedDB 回退
  let db = bookIndexes.get(bookId)
  if (!db) {
    const restored = await restoreBookIndex(bookId)
    if (!restored) {
      reply({ type: 'error', message: '该书籍尚未建立索引，请先打开书籍完成索引' })
      return
    }
    db = bookIndexes.get(bookId)!
  }

  // Step 2: query 向量化
  const queryVectors = await embed([query])
  const queryVector = queryVectors[0]!

  // Step 3: Orama 向量检索
  const searchResult = await search(db, {
    mode: 'vector',
    vector: {
      value: queryVector,
      property: 'embedding',
    },
    limit: topK,
  })

  // Step 4: 结果映射为 SearchResult[]
  const results: SearchResult[] = searchResult.hits.map((hit) => ({
    text: hit.document.text as string,
    cfi: hit.document.cfi as string,
    chapter: hit.document.chapter as string,
    score: hit.score,
  }))

  // Step 5: 回复检索结果
  reply({ type: 'search:result', results, ...(requestId && { requestId }) })
}

// ---- 消息分发 ----

function reply(response: WorkerResponse) {
  self.postMessage(response)
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data

  try {
    switch (message.type) {
      case 'ping': {
        await getEmbeddingPipeline()
        reply({ type: 'pong' })
        break
      }

      case 'status': {
        const { bookId, requestId } = message
        // 两级检查：先内存 Map，再 IndexedDB
        const inMemory = bookIndexes.has(bookId)
        const inDB = !inMemory ? await existsInIndexedDB(`book_${bookId}`) : false
        reply({
          type: 'status:result',
          bookId,
          isIndexed: inMemory || inDB,
          ...(requestId && { requestId }),
        })
        break
      }

      case 'ingest': {
        await handleIngest(message.bookId, message.chapters)
        break
      }

      case 'search': {
        await handleSearch(message.bookId, message.query, message.topK ?? 5, message.requestId)
        break
      }

      default: {
        const unknownType = (message as { type: string }).type
        reply({ type: 'error', message: `Unknown message type: ${unknownType}` })
        break
      }
    }
  } catch (error) {
    reply({ type: 'error', message: String(error) })
  }
}

// 导出供后续模块使用
export { embed, getEmbeddingPipeline, bookIndexes, restoreBookIndex }
