/**
 * PersonaGenerator — RAG + LLM 角色人设生成管道
 *
 * 流程: 索引检查 → 并发三维度 RAG 检索 → Prompt 组装 → LLM 调用 → JSON 解析 → systemPrompt 生成
 *
 * 核心原则:
 * - P-2: RAG 检索通过 Web Worker postMessage，不在渲染进程执行
 * - P-1: 仅 LLM API 调用产生出站流量
 */

import type { Message, LlmConfig } from '@/shared/types'
import { createLlmStream } from '@/shared/utils/llm-stream'
import type {
  SearchResult,
  SearchMessage,
  SearchResultResponse,
  StatusMessage,
  StatusResultResponse,
  ErrorResponse,
  WorkerResponse,
} from '@/workers/rag-types'

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
  RAG_TIMEOUT: 'RAG_TIMEOUT',
  NO_RELEVANT_CONTENT: 'NO_RELEVANT_CONTENT',
  LLM_ERROR: 'LLM_ERROR',
  PERSONA_PARSE_ERROR: 'PERSONA_PARSE_ERROR',
} as const

/** RAG Worker 通信超时时间 (ms) */
const RAG_TIMEOUT_MS = 10_000

/** 检索结果 score 最低阈值 */
const MIN_SCORE_THRESHOLD = 0.3

// ============================================
// 1. Worker 通信封装
// ============================================

/**
 * 封装 Worker postMessage/onmessage 为 Promise 的 RAG 搜索调用
 * 使用 requestId 防止并发调用时的消息混淆
 */
let _requestCounter = 0
function searchRag(
  worker: Worker,
  bookId: string,
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const requestId = `search_${++_requestCounter}_${Date.now()}`
  return new Promise<SearchResult[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(ERROR_CODES.RAG_TIMEOUT))
    }, RAG_TIMEOUT_MS)

    function handler(event: MessageEvent<WorkerResponse>): void {
      const data = event.data
      if (data.type === 'search:result') {
        const result = data as SearchResultResponse
        // 仅匹配当前 requestId 的响应（向后兼容：无 requestId 时也接受）
        if (!result.requestId || result.requestId === requestId) {
          cleanup()
          resolve(result.results)
        }
      } else if (data.type === 'error') {
        cleanup()
        reject(new Error((data as ErrorResponse).message))
      }
    }

    function cleanup(): void {
      clearTimeout(timer)
      worker.removeEventListener('message', handler)
    }

    worker.addEventListener('message', handler)

    const msg: SearchMessage = { type: 'search', bookId, query, topK, requestId }
    worker.postMessage(msg)
  })
}

/**
 * 通过 StatusMessage 检查书籍是否已完成向量化索引
 */
function checkBookIndexed(worker: Worker, bookId: string): Promise<boolean> {
  const requestId = `status_${++_requestCounter}_${Date.now()}`
  return new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(ERROR_CODES.RAG_TIMEOUT))
    }, RAG_TIMEOUT_MS)

    function handler(event: MessageEvent<WorkerResponse>): void {
      const data = event.data
      if (data.type === 'status:result') {
        const result = data as StatusResultResponse
        if (result.bookId === bookId && (!result.requestId || result.requestId === requestId)) {
          cleanup()
          resolve(result.isIndexed)
        }
      } else if (data.type === 'error') {
        cleanup()
        reject(new Error((data as ErrorResponse).message))
      }
    }

    function cleanup(): void {
      clearTimeout(timer)
      worker.removeEventListener('message', handler)
    }

    worker.addEventListener('message', handler)

    const msg: StatusMessage = { type: 'status', bookId, requestId }
    worker.postMessage(msg)
  })
}

// ============================================
// 2. RAG 检索管道
// ============================================

/**
 * 并发三维度 RAG 检索，合并去重并过滤低分结果
 */
async function fetchRagContext(
  worker: Worker,
  bookId: string,
  characterName: string
): Promise<SearchResult[]> {
  const queries = [
    `${characterName} 性格特征 性格 为人`,
    `${characterName} 台词 说话 名言`,
    `${characterName} 经历 事件 结局`,
  ]

  const allSearchResults = await Promise.all(
    queries.map((q) => searchRag(worker, bookId, q, 5))
  )

  // 合并所有结果
  const allResults = allSearchResults.flat()

  // 按 text 去重
  const seen = new Set<string>()
  const unique: SearchResult[] = []
  for (const r of allResults) {
    if (!seen.has(r.text)) {
      seen.add(r.text)
      unique.push(r)
    }
  }

  // 过滤低分结果
  const filtered = unique.filter((r) => r.score >= MIN_SCORE_THRESHOLD)

  if (filtered.length === 0) {
    throw new Error(ERROR_CODES.NO_RELEVANT_CONTENT)
  }

  return filtered
}

// ============================================
// 3. LLM Prompt 与调用
// ============================================

/** System Prompt：角色分析专家指令 */
const ANALYSIS_SYSTEM_PROMPT = `你是一个专业的文学角色分析专家。你的任务是根据提供的书籍原文片段，分析并生成角色的详细设定。

你必须只返回一个合法的 JSON 对象，不要添加任何额外的文字说明、markdown 标记或代码块。

JSON 对象必须包含以下字段：
- "description": 角色的简要描述（1-2句话）
- "personality": 角色的性格特征描述
- "speechStyle": 角色的说话风格和语言特点
- "background": 角色的背景故事和经历
- "keyQuotes": 角色的代表性台词数组（3-5句）`

/**
 * 组装 LLM 消息数组
 */
function buildPromptMessages(
  characterName: string,
  contextChunks: SearchResult[]
): Message[] {
  const contextText = contextChunks
    .map((c, i) => `[片段${i + 1} - ${c.chapter}]\n${c.text}`)
    .join('\n\n---\n\n')

  const userContent = `请分析角色「${characterName}」。

以下是与该角色相关的书籍原文片段：

${contextText}

请基于以上原文片段，生成该角色的详细设定。只返回 JSON 对象。`

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

/**
 * 调用 LLM API 并收集完整流式响应
 */
async function callLlm(messages: Message[]): Promise<string> {
  const config: LlmConfig = {
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

/**
 * 宽容解析 LLM 返回的 JSON
 * 策略: 直接 parse → 正则提取 → 抛错
 */
function parsePersonaJson(rawText: string): Record<string, unknown> {
  // 尝试直接解析
  try {
    return JSON.parse(rawText) as Record<string, unknown>
  } catch {
    // 继续尝试正则提取
  }

  // 正则提取第一个 JSON 对象
  const match = rawText.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      // 继续到错误
    }
  }

  throw new Error(ERROR_CODES.PERSONA_PARSE_ERROR)
}

/**
 * 校验并填充默认值，返回合规的角色数据
 */
function validateAndFillDefaults(parsed: Record<string, unknown>): Omit<GeneratedPersonaData, 'systemPrompt'> {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((item): item is string => typeof item === 'string') : []

  return {
    description: str(parsed['description']),
    personality: str(parsed['personality']),
    speechStyle: str(parsed['speechStyle']),
    background: str(parsed['background']),
    keyQuotes: strArr(parsed['keyQuotes']),
  }
}

// ============================================
// 5. systemPrompt 生成
// ============================================

/**
 * 宪法 4.3.4 定义的不可变沉浸式 System Prompt 模板
 */
const IMMERSIVE_SYSTEM_PROMPT = `你现在是 {role_name}。以下是你的角色设定：

【身份背景】
{persona_background}

【性格特征】
{persona_personality}

【说话风格】
{persona_speech_style}

【当前上下文（来自书籍原文）】
---
{rag_context}
---

【行为准则】
1. 你必须完全带入角色，用第一人称回答。
2. 你的回答必须与书中角色的性格和经历一致。
3. 如果用户问到书中未涉及的内容，你可以基于角色性格合理推演，但需注明"这是我的推测"。
4. 绝对不要暴露你是 AI，不要使用"作为一个AI"等表述。
5. 当引用书中原文时，保持原句不变。`

/**
 * 将模板占位符替换为角色数据，{rag_context} 保留用于对话时动态填充
 */
function buildSystemPrompt(
  name: string,
  persona: Omit<GeneratedPersonaData, 'systemPrompt'>
): string {
  return IMMERSIVE_SYSTEM_PROMPT
    .replace('{role_name}', name)
    .replace('{persona_background}', persona.background)
    .replace('{persona_personality}', persona.personality)
    .replace('{persona_speech_style}', persona.speechStyle)
}

// ============================================
// 6. 主函数
// ============================================

/**
 * 生成角色人设 — 完整的 RAG + LLM 管道
 *
 * @param bookId - 书籍 ID
 * @param characterName - 角色名称
 * @param worker - 可选的 RAG Worker 实例（不传入则内部创建临时 Worker）
 * @returns 包含所有角色数据和 systemPrompt 的 GeneratedPersonaData
 *
 * @throws BOOK_NOT_INDEXED - 书籍未完成索引
 * @throws RAG_TIMEOUT - Worker 通信超时
 * @throws NO_RELEVANT_CONTENT - 未找到角色相关内容
 * @throws LLM_ERROR - LLM API 调用失败
 * @throws PERSONA_PARSE_ERROR - LLM 返回格式无法解析
 */
export async function generatePersona(
  bookId: string,
  characterName: string,
  worker?: Worker | undefined
): Promise<GeneratedPersonaData> {
  // 获取或创建 Worker
  let w: Worker
  let isTemporary = false

  if (worker) {
    w = worker
  } else {
    w = new Worker(new URL('@/workers/rag.worker.ts', import.meta.url), { type: 'module' })
    isTemporary = true
  }

  try {
    // Step 1: 检查书籍索引状态
    const isIndexed = await checkBookIndexed(w, bookId)
    if (!isIndexed) {
      throw new Error(ERROR_CODES.BOOK_NOT_INDEXED)
    }

    // Step 2: 并发三维度 RAG 检索
    const contextChunks = await fetchRagContext(w, bookId, characterName)

    // Step 3: 组装 LLM Prompt
    const messages = buildPromptMessages(characterName, contextChunks)

    // Step 4: 调用 LLM 并收集响应
    const rawResponse = await callLlm(messages)

    // Step 5: 解析 JSON 响应
    const parsed = parsePersonaJson(rawResponse)
    const personaData = validateAndFillDefaults(parsed)

    // Step 6: 生成 systemPrompt
    const systemPrompt = buildSystemPrompt(characterName, personaData)

    return {
      ...personaData,
      systemPrompt,
    }
  } finally {
    // 清理临时 Worker
    if (isTemporary) {
      w.terminate()
    }
  }
}
