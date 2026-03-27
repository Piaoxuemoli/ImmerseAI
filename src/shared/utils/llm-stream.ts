/**
 * LLM Stream 工具函数
 *
 * 在渲染进程内部构建 ReadableStream，通过 preload 暴露的事件订阅接口接收数据。
 * 避免将 ReadableStream 对象跨 contextBridge 边界传递（会导致方法丢失）。
 */

import type { Message, LlmConfig } from '@/shared/types'

/**
 * 创建一个包装 IPC 事件流的 ReadableStream
 *
 * - 先注册 onChunk / onError 监听，再发起 invoke，保证不丢失任何事件
 * - [DONE] 信号触发 controller.close()
 * - 错误事件触发 controller.error()
 * - stream.cancel() 时调用 cancelChat() 清理所有监听
 */
export function createLlmStream(messages: Message[], config: LlmConfig): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      const removeChunk = window.electronAPI.llm.onChunk((chunk) => {
        if (chunk === '[DONE]') {
          removeChunk()
          removeError()
          controller.close()
        } else {
          controller.enqueue(chunk)
        }
      })

      const removeError = window.electronAPI.llm.onError((err) => {
        removeChunk()
        removeError()
        controller.error(new Error(err.message))
      })

      window.electronAPI.llm.chat(messages, config).catch((e: Error) => {
        removeChunk()
        removeError()
        controller.error(e)
      })
    },
    cancel() {
      window.electronAPI.llm.cancelChat()
    },
  })
}
