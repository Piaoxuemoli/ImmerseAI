/**
 * 笔记内容生成服务
 *
 * 调用 LLM 基于对话上下文生成结构化 Markdown 笔记
 */

import type { Message, StoreLlmConfig } from '@/shared/types'
import { buildNoteSystemPrompt } from '../utils/note-prompt'
import { createLlmStream } from '@/shared/utils/llm-stream'

/** 笔记生成使用的最大上下文消息数 */
const MAX_CONTEXT_MESSAGES = 10

/**
 * 调用 LLM 生成结构化笔记内容
 *
 * @param messages - 当前对话消息列表
 * @param bookTitle - 书籍标题
 * @param topic - 指定主题（可选，LLM 自动总结）
 * @returns 生成的 Markdown 笔记文本
 * @throws Error 如果 LLM 调用失败
 */
export async function generateNoteContent(
  messages: Message[],
  bookTitle: string,
  llmConfig: StoreLlmConfig,
  topic?: string,
): Promise<string> {
  // 取最近 N 条消息作为上下文（排除 system 消息）
  const contextMessages = messages
    .filter((m) => m.role !== 'system')
    .slice(-MAX_CONTEXT_MESSAGES)

  // 构造笔记专用 system prompt
  const systemPrompt = buildNoteSystemPrompt(bookTitle, topic)

  // 构建 LLM 请求消息
  const llmMessages: Message[] = [
    {
      id: crypto.randomUUID(),
      role: 'system',
      content: systemPrompt,
      timestamp: 0,
    },
    // 将对话上下文作为参考
    ...contextMessages,
    // 最后追加一条指令消息
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: '请根据以上对话内容生成阅读笔记。',
      timestamp: Date.now(),
    },
  ]

  try {
    const stream = createLlmStream(llmMessages, { ...llmConfig, stream: true })
    const reader = stream.getReader()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) fullContent += value
    }

    if (fullContent.trim().length === 0) {
      throw new Error('LLM 返回了空内容')
    }

    return fullContent
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    throw new Error(`笔记生成失败: ${errorMessage}`)
  }
}
