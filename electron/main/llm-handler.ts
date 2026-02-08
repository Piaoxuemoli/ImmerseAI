/**
 * LLM Handler - OpenAI Compatible 流式 Chat Completion
 *
 * 支持 provider 路由：DeepSeek / Kimi / Moonshot / OpenAI / Custom
 * 使用 openai SDK 单例 client，configHash 脏检测按需重建
 */

import OpenAI from 'openai'
import type { IpcMainInvokeEvent } from 'electron'
import type { Message, LlmConfig } from '@/shared/types'
import { getSafeStorageValue } from './safe-storage'

// ========================================
// 常量定义
// ========================================

/** Provider 名称到 API 端点的映射表 */
const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  kimi: 'https://api.moonshot.cn/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  openai: 'https://api.openai.com/v1',
}

/** 默认 LLM 配置 */
export const DEFAULT_LLM_CONFIG: Required<Pick<LlmConfig, 'temperature' | 'maxTokens' | 'model'>> = {
  temperature: 0.7,
  maxTokens: 2048,
  model: 'deepseek-chat',
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
function computeConfigHash(apiKey: string, provider: string, baseUrl: string): string {
  return `${provider}:${baseUrl}:${apiKey.slice(0, 8)}`
}

/**
 * 解析 provider 对应的 baseUrl
 */
function resolveBaseUrl(provider: string, customBaseUrl?: string): string {
  if (provider === 'custom') {
    if (!customBaseUrl) {
      throw new Error('Custom provider requires a baseUrl')
    }
    return customBaseUrl
  }
  return PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS['deepseek']
}

/**
 * 获取或创建 OpenAI client
 * 配置变更时自动重建
 */
function getOrCreateClient(apiKey: string, provider: string, baseUrl: string): OpenAI {
  const hash = computeConfigHash(apiKey, provider, baseUrl)

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

/**
 * 将 OpenAI SDK 异常分类为结构化错误
 */
function classifyError(error: unknown): LlmChatError {
  if (error instanceof OpenAI.AuthenticationError) {
    return { code: 'AUTH_FAILED', message: error.message }
  }
  if (error instanceof OpenAI.RateLimitError) {
    return { code: 'RATE_LIMITED', message: error.message }
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return { code: 'NETWORK_ERROR', message: error.message }
  }
  if (error instanceof OpenAI.APIError) {
    return { code: 'UNKNOWN_ERROR', message: error.message }
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: error.message }
  }
  return { code: 'UNKNOWN_ERROR', message: String(error) }
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
  // 合并默认配置
  const mergedConfig = { ...DEFAULT_LLM_CONFIG, ...config }
  const provider = mergedConfig.provider || 'deepseek'

  // 获取 API Key
  const apiKey = getSafeStorageValue('llm-api-key')
  if (!apiKey) {
    throw new Error('API_KEY_NOT_CONFIGURED')
  }

  // 解析 baseUrl（custom provider 从 safeStorage 读取）
  let baseUrl: string
  if (provider === 'custom') {
    const customBaseUrl = getSafeStorageValue('llm-base-url')
    baseUrl = resolveBaseUrl(provider, customBaseUrl)
  } else {
    baseUrl = resolveBaseUrl(provider)
  }

  // 获取或创建 client
  const client = getOrCreateClient(apiKey, provider, baseUrl)

  // 转换消息格式为 OpenAI SDK 格式
  const openaiMessages = messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }))

  try {
    // 流式调用
    const stream = await client.chat.completions.create({
      model: mergedConfig.model,
      messages: openaiMessages,
      stream: true,
      temperature: mergedConfig.temperature,
      max_tokens: mergedConfig.maxTokens,
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
      event.sender.send('llm:chat-chunk', '[DONE]')
    }
  } catch (error: unknown) {
    // 流中错误：发送结构化错误事件 + [DONE] 关闭流
    if (!event.sender.isDestroyed()) {
      const llmError = classifyError(error)
      event.sender.send('llm:chat-error', llmError)
      event.sender.send('llm:chat-chunk', '[DONE]')
    }
  }
}
