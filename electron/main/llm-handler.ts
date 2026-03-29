/**
 * LLM Handler - OpenAI Compatible 流式 Chat Completion
 *
 * 统一 OpenAI 兼容单一入口，不区分 provider
 * 使用 openai SDK 单例 client，configHash 脏检测按需重建
 */

import OpenAI from 'openai'
import type { IpcMainInvokeEvent } from 'electron'
import type { Message, LlmConfig } from '@/shared/types'
import { getSafeStorageValue } from './safe-storage'

// ========================================
// 常量定义
// ========================================

/** 默认 LLM 配置 */
export const DEFAULT_LLM_CONFIG = {
  temperature: 0.7,
  maxTokens: 2048,
}

// ========================================
// 结构化错误类型
// ========================================

/** LLM 聊天错误 */
interface LlmChatError {
  code: string
  message: string
}

// ========================================
// Client 缓存管理
// ========================================

let cachedClient: { client: OpenAI; configHash: string } | null = null

/**
 * 计算配置的 hash 用于脏检测
 */
function computeConfigHash(apiKey: string, baseUrl: string): string {
  return `${baseUrl}:${apiKey.slice(0, 8)}`
}

/**
 * 获取或创建 OpenAI client
 * 配置变更时自动重建
 */
function getOrCreateClient(apiKey: string, baseUrl: string): OpenAI {
  const hash = computeConfigHash(apiKey, baseUrl)

  if (cachedClient && cachedClient.configHash === hash) {
    return cachedClient.client
  }

  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
    maxRetries: 2,
    timeout: 30000,
  })

  cachedClient = { client, configHash: hash }
  return client
}

// ========================================
// 错误分类
// ========================================

/** LLM 错误码 - 标准化分类 */
export type LlmErrorCode =
  | 'invalid_key'
  | 'not_configured'
  | 'rate_limited'
  | 'network_error'
  | 'server_error'
  | 'unknown'

/** 错误码到中文消息的映射 */
const ERROR_CODE_MESSAGES: Record<LlmErrorCode, string> = {
  invalid_key: 'API 密钥无效，请检查设置中的密钥配置',
  not_configured: 'LLM 尚未完成配置，请在设置中填写 API Key、Base URL 和 Model',
  rate_limited: '请求过于频繁，请稍后再试',
  network_error: '网络连接失败，请检查网络状态',
  server_error: '服务器繁忙，请稍后重试',
  unknown: '发生未知错误，请重试',
}

/**
 * 将 OpenAI SDK 异常分类为结构化错误
 * 返回标准化 code 和用户可读中文 message
 */
function classifyError(error: unknown): LlmChatError {
  // 身份验证错误 → invalid_key
  if (error instanceof OpenAI.AuthenticationError) {
    return { code: 'invalid_key', message: ERROR_CODE_MESSAGES.invalid_key }
  }

  // 速率限制 → rate_limited
  if (error instanceof OpenAI.RateLimitError) {
    return { code: 'rate_limited', message: ERROR_CODE_MESSAGES.rate_limited }
  }

  // 连接错误 → network_error
  if (error instanceof OpenAI.APIConnectionError) {
    return { code: 'network_error', message: ERROR_CODE_MESSAGES.network_error }
  }

  // 其他 API 错误 → 根据 status 进一步区分
  if (error instanceof OpenAI.APIError) {
    const status = error.status
    // 5xx 服务器错误
    if (status && status >= 500) {
      return { code: 'server_error', message: ERROR_CODE_MESSAGES.server_error }
    }
    // 401/403 认证相关
    if (status === 401 || status === 403) {
      return { code: 'invalid_key', message: ERROR_CODE_MESSAGES.invalid_key }
    }
    // 429 速率限制（双重检查）
    if (status === 429) {
      return { code: 'rate_limited', message: ERROR_CODE_MESSAGES.rate_limited }
    }
    // 400/404/409/422/403 等客户端错误 → 根据错误码或 status 细分
    if (status !== undefined) {
      // BadRequestError (400) - 请求格式/参数错误，可能是 API Key 无效或模型不支持
      if (error instanceof OpenAI.BadRequestError || status === 400) {
        // 进一步检查是否因 API Key 导致的 400（某些 provider 对无效 key 返回 400）
        const msg = (error as { error?: { message?: string } }).error?.message ?? ''
        if (msg.toLowerCase().includes('key') || msg.toLowerCase().includes('auth')) {
          return { code: 'invalid_key', message: ERROR_CODE_MESSAGES.invalid_key }
        }
        return { code: 'unknown', message: ERROR_CODE_MESSAGES.unknown }
      }
      // 未找到资源
      if (error instanceof OpenAI.NotFoundError || status === 404) {
        return { code: 'unknown', message: ERROR_CODE_MESSAGES.unknown }
      }
      // 服务器拒绝/权限不足
      if (error instanceof OpenAI.PermissionDeniedError || status === 403) {
        return { code: 'invalid_key', message: ERROR_CODE_MESSAGES.invalid_key }
      }
      // 冲突
      if (error instanceof OpenAI.ConflictError || status === 409) {
        return { code: 'unknown', message: ERROR_CODE_MESSAGES.unknown }
      }
      // 无法处理的实体
      if (error instanceof OpenAI.UnprocessableEntityError || status === 422) {
        return { code: 'unknown', message: ERROR_CODE_MESSAGES.unknown }
      }
      // 所有其他 HTTP 错误码都归为 unknown
      return { code: 'unknown', message: ERROR_CODE_MESSAGES.unknown }
    }
    // status 为 undefined 但是 APIError 子类 → 检查嵌套 error.code
    const nestedCode = (error as { error?: { code?: string } }).error?.code
    if (nestedCode === 'invalid_api_key' || nestedCode === ' Incorrect_api_key') {
      return { code: 'invalid_key', message: ERROR_CODE_MESSAGES.invalid_key }
    }
    return { code: 'unknown', message: ERROR_CODE_MESSAGES.unknown }
  }

  // 其他 Error 类型
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    // 尝试识别网络错误
    if (
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('enotfound') ||
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('socket')
    ) {
      return { code: 'network_error', message: ERROR_CODE_MESSAGES.network_error }
    }
    // abort / cancel
    if (msg.includes('abort') || msg.includes('cancel')) {
      return { code: 'unknown', message: ERROR_CODE_MESSAGES.unknown }
    }
    return { code: 'unknown', message: ERROR_CODE_MESSAGES.unknown }
  }

  return { code: 'unknown', message: ERROR_CODE_MESSAGES.unknown }
}

// ========================================
// 主函数
// ========================================

/**
 * 处理 LLM 聊天请求
 *
 * 流程: 合并默认配置 → 获取 API Key → 创建/复用 client → 流式调用 → 逐 chunk 发送
 */
export async function handleLlmChat(
  event: IpcMainInvokeEvent,
  messages: Message[],
  config: LlmConfig
): Promise<void> {
  // Capture start time for duration tracking
  ;(event as unknown as { _startTime: number })._startTime = Date.now()

  const mergedConfig = {
    ...DEFAULT_LLM_CONFIG,
    ...config,
  }
  const temperature = mergedConfig.temperature
  const maxTokens = mergedConfig.maxTokens
  const baseUrl = (config.baseUrl ?? '').trim()
  const model = (config.model ?? '').trim()

  // 获取 API Key
  const apiKey = getSafeStorageValue('llm_api_key')
  if (!apiKey || !baseUrl || !model) {
    if (!event.sender.isDestroyed()) {
      event.sender.send('llm:chat-error', {
        code: 'not_configured',
        message: ERROR_CODE_MESSAGES.not_configured,
      })
      event.sender.send('llm:chat-complete', { totalDuration: Date.now() - (event as unknown as { _startTime: number })._startTime })
    }
    return
  }

  try {
    // 获取或创建 client
    const client = getOrCreateClient(apiKey, baseUrl)

    // 转换消息格式为 OpenAI SDK 格式
    const openaiMessages = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }))

    // 流式调用
    const stream = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      stream: true,
      temperature,
      max_tokens: maxTokens,
    })

    // 逐 chunk 发送到渲染进程
    for await (const chunk of stream) {
      // 检查渲染进程是否已销毁
      if (event.sender.isDestroyed()) {
        break
      }

      const content = chunk.choices[0]?.delta?.content
      if (content) {
        event.sender.send('llm:chat-chunk', content)
      }
    }

    // 流正常结束，发送完成信号
    if (!event.sender.isDestroyed()) {
      event.sender.send('llm:chat-complete', { totalDuration: Date.now() - (event as unknown as { _startTime: number })._startTime })
    }
  } catch (error: unknown) {
    // 流中错误：发送结构化错误事件 + llm:chat-complete 关闭流
    if (!event.sender.isDestroyed()) {
      const llmError = classifyError(error)
      event.sender.send('llm:chat-error', llmError)
      event.sender.send('llm:chat-complete', { totalDuration: Date.now() - (event as unknown as { _startTime: number })._startTime })
    }
  }
}
