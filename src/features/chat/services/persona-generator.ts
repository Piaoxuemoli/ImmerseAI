/**
 * PersonaGenerator — RAG + LLM 角色人设生成管道
 *
 * 架构升级：RAG 检索通过 IPC 调用主进程实现，不再依赖 Web Worker。
 * 主进程运行在 Node.js 中，不受 file:// 协议限制。
 */

import { useStore } from '@/shared/store'
import type { Citation, Message, LlmConfig, StoreLlmConfig, RagSearchResult, RagParagraph } from '@/shared/types'
import { createLlmStream } from '@/shared/utils/llm-stream'

// ============================================
// 接口定义
// ============================================

export interface GeneratedPersonaData {
  description: string
  personality: string
  speechStyle: string
  background: string
  keyQuotes: string[]
  systemPrompt: string
}

// ============================================
// 错误码常量
// ============================================

const ERROR_CODES = {
  BOOK_NOT_INDEXED: 'BOOK_NOT_INDEXED',
  NO_RELEVANT_CONTENT: 'NO_RELEVANT_CONTENT',
  LLM_ERROR: 'LLM_ERROR',
  PERSONA_PARSE_ERROR: 'PERSONA_PARSE_ERROR',
} as const

const MIN_SCORE_THRESHOLD = 0
const PERSONA_CONTEXT_LIMIT = 25
export const RAG_CONTEXT_PLACEHOLDER = '{rag_context}'

// ============================================
// 1. RAG IPC 封装
// ============================================

/**
 * 通过 IPC 调用主进程 RAG 检索
 * contentHash 从 Zustand store 中的 book.contentHash 获取
 */
async function searchRagViaIpc(
  bookId: string,
  query: string,
  topK = 5,
): Promise<RagSearchResult[]> {
  const book = useStore.getState().books.find((b) => b.id === bookId)
  if (!book?.contentHash) return []
  return window.electronAPI.rag.search(book.contentHash, query, topK)
}

/**
 * 检查书籍是否已在主进程 RAG 缓存中存在
 * 支持两种情况：
 * 1. book.contentHash 存在 → 直接查询 rag:status
 * 2. book.contentHash 不存在 → 返回 false（需重新索引）
 */
export async function checkBookIndexedStatus(bookId: string): Promise<boolean> {
  const book = useStore.getState().books.find((b) => b.id === bookId)
  if (!book?.contentHash) return false
  return window.electronAPI.rag.status(book.contentHash)
}

// ============================================
// 2. RAG 检索管道
// ============================================

function normalizeSearchResults(
  results: RagSearchResult[],
  limit: number,
  minScoreThreshold = MIN_SCORE_THRESHOLD,
): RagSearchResult[] {
  const seen = new Set<string>()
  const unique: RagSearchResult[] = []
  for (const r of results) {
    if (!seen.has(r.text)) {
      seen.add(r.text)
      unique.push(r)
    }
  }

  const filtered = unique
    .filter((r) => r.score >= minScoreThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  if (filtered.length === 0) {
    throw new Error(ERROR_CODES.NO_RELEVANT_CONTENT)
  }

  return filtered
}

async function fetchPersonaRagContext(
  bookId: string,
  characterName: string,
): Promise<RagSearchResult[]> {
  const results = await searchRagViaIpc(bookId, characterName, PERSONA_CONTEXT_LIMIT)
  return normalizeSearchResults(results, PERSONA_CONTEXT_LIMIT)
}

// ============================================
// 3. LLM Prompt 与调用
// ============================================

const ANALYSIS_SYSTEM_PROMPT = `你是一个专业的文学角色分析专家。你的任务是根据提供的书籍原文片段，分析并生成角色的详细设定。

你必须只返回一个合法的 JSON 对象，不要添加任何额外的文字说明、markdown 标记或代码块。

JSON 对象必须包含以下字段：
- "description": 角色的简要描述（1-2句话）
- "personality": 角色的性格特征描述
- "speechStyle": 角色的说话风格和语言特点
- "background": 角色的背景故事和经历
- "keyQuotes": 角色的代表性台词数组（3-5句）
- "systemPrompt": 面向对话模型的完整系统提示词，必须让模型以该角色身份进行沉浸式回答`

function buildPromptMessages(
  bookTitle: string,
  characterName: string,
  contextChunks: RagSearchResult[],
): Message[] {
  const contextText = contextChunks
    .map((c, i) => `[片段${i + 1} - 段落 ${c.paragraphIndex}]\n${c.text}`)
    .join('\n\n---\n\n')

  const userContent = `请为书籍《${bookTitle}》中的角色「${characterName}」生成沉浸式对话人设。

以下是与该角色直接相关的 25 条书籍原文片段：

${contextText}

请严格基于这些原文内容完成分析，并返回一个 JSON 对象。

要求：
1. systemPrompt 必须可直接作为聊天系统提示词使用。
2. systemPrompt 必须明确角色身份、说话方式、行为边界，以及"优先依据原文片段回答"的要求。
3. 如果片段不足以支持某些信息，请在 systemPrompt 中要求模型谨慎推断，不得编造确定事实。
4. systemPrompt 中必须原样包含占位符 ${RAG_CONTEXT_PLACEHOLDER}，用于后续注入实时检索上下文。
5. 不要输出 markdown，不要输出代码块。`

  return [
    {
      id: crypto.randomUUID(),
      role: 'system' as const,
      content: ANALYSIS_SYSTEM_PROMPT,
      timestamp: Date.now(),
    },
    {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: userContent,
      timestamp: Date.now(),
    },
  ]
}

async function callLlm(messages: Message[], llmConfig: StoreLlmConfig): Promise<string> {
  const config: LlmConfig = {
    ...llmConfig,
    temperature: 0.3,
    maxTokens: 2048,
  }
  const stream = createLlmStream(messages, config)
  const reader = stream.getReader()
  let fullText = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) fullText += value
    }
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`${ERROR_CODES.LLM_ERROR}: ${detail}`)
  } finally {
    reader.releaseLock()
  }

  if (fullText.trim() === '') {
    throw new Error(`${ERROR_CODES.LLM_ERROR}: Empty response from LLM`)
  }

  return fullText
}

// ============================================
// 4. 响应解析
// ============================================

function parsePersonaJson(rawText: string): Record<string, unknown> {
  try {
    return JSON.parse(rawText) as Record<string, unknown>
  } catch {
    // continue
  }

  const match = rawText.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      // continue
    }
  }

  throw new Error(ERROR_CODES.PERSONA_PARSE_ERROR)
}

function validateAndFillDefaults(parsed: Record<string, unknown>): GeneratedPersonaData {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((item): item is string => typeof item === 'string') : []

  return {
    description: str(parsed['description']),
    personality: str(parsed['personality']),
    speechStyle: str(parsed['speechStyle']),
    background: str(parsed['background']),
    keyQuotes: strArr(parsed['keyQuotes']),
    systemPrompt: str(parsed['systemPrompt']),
  }
}

function buildFallbackSystemPrompt(bookTitle: string, characterName: string): string {
  return `你现在是《${bookTitle}》中的角色 ${characterName}。

请完全以该角色身份进行沉浸式回答，优先依据当前提供的书籍原文片段作答。

当前上下文：
${RAG_CONTEXT_PLACEHOLDER}

要求：
1. 使用第一人称回答。
2. 保持与原文中呈现出的经历、性格和语言风格一致。
3. 若用户提问超出原文范围，可以谨慎推测，但必须明确说明这是推测。
4. 不要暴露你是 AI。
5. 当系统提供书籍片段时，优先引用和依赖这些片段。`
}

function ensureRagPlaceholder(systemPrompt: string): string {
  if (systemPrompt.includes(RAG_CONTEXT_PLACEHOLDER)) {
    return systemPrompt
  }
  return `${systemPrompt}\n\n当前上下文：\n${RAG_CONTEXT_PLACEHOLDER}`
}

// ============================================
// 5. 主函数
// ============================================

/**
 * 生成角色人设 — RAG 检索 + LLM 分析管道
 */
export async function generatePersona(
  bookId: string,
  bookTitle: string,
  characterName: string,
  llmConfig: StoreLlmConfig,
): Promise<GeneratedPersonaData> {
  const isIndexed = await checkBookIndexedStatus(bookId)
  if (!isIndexed) {
    throw new Error(ERROR_CODES.BOOK_NOT_INDEXED)
  }

  const contextChunks = await fetchPersonaRagContext(bookId, characterName)
  const messages = buildPromptMessages(bookTitle, characterName, contextChunks)
  const rawResponse = await callLlm(messages, llmConfig)
  const parsed = parsePersonaJson(rawResponse)
  const personaData = validateAndFillDefaults(parsed)

  return {
    ...personaData,
    systemPrompt: ensureRagPlaceholder(
      personaData.systemPrompt || buildFallbackSystemPrompt(bookTitle, characterName),
    ),
  }
}

// ============================================
// 6. 辅助工具函数
// ============================================

export function buildRagContext(results: RagSearchResult[]): string {
  if (results.length === 0) return '当前没有检索到相关书籍上下文。'
  return results
    .map((result, index) => `[片段${index + 1} - 段落 ${result.paragraphIndex}]\n${result.text}`)
    .join('\n\n---\n\n')
}

export function injectRagContext(systemPrompt: string, results: RagSearchResult[]): string {
  return systemPrompt.replace(RAG_CONTEXT_PLACEHOLDER, buildRagContext(results))
}

export function buildCitations(results: RagSearchResult[]): Citation[] {
  return results.map((result) => ({
    paragraphIndex: result.paragraphIndex,
    offset: result.offset,
    text: result.text,
    score: result.score,
  }))
}

export function splitContentToParagraphs(content: string): RagParagraph[] {
  const paragraphs = content
    .split(/\n\s*\n+/)
    .map((text) => text.trim())
    .filter(Boolean)

  return paragraphs.map((text, index) => ({
    index,
    text,
    offset: 0,
  }))
}

/**
 * 通过 IPC 检索书籍相关上下文片段
 */
export async function searchBookContext(
  bookId: string,
  query: string,
  topK = 5,
): Promise<RagSearchResult[]> {
  const results = await searchRagViaIpc(bookId, query, topK)
  if (results.length === 0) return []

  const seen = new Set<string>()
  const unique: RagSearchResult[] = []
  for (const r of results) {
    if (!seen.has(r.text)) {
      seen.add(r.text)
      unique.push(r)
    }
  }
  return unique.sort((a, b) => b.score - a.score).slice(0, topK)
}
