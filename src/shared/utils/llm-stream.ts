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
 * - llm:chat-complete 事件触发 controller.close()
 * - 错误事件触发 controller.error()
 * - stream.cancel() 时调用 cancelChat() 清理所有监听
 */
export function createLlmStream(messages: Message[], config: LlmConfig): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      const removeChunk = window.electronAPI.llm.onChunk((chunk) => {
        controller.enqueue(chunk)
      })

      const removeError = window.electronAPI.llm.onError((err) => {
        removeChunk()
        removeError()
        // 传递完整错误对象而非仅 message，保留 code 字段用于调试
        controller.error(Object.assign(new Error(err.message), { code: err.code }))
      })

      const removeComplete = window.electronAPI.llm.onChatComplete(() => {
        removeChunk()
        removeError()
        removeComplete()
        // safe close：只有在 stream 未 error 时才能 close
        // 如果已 error，忽略 close 调用避免 "Cannot close an errored stream" 异常
        try {
          controller.close()
        } catch {
          // stream 已 errored，忽略
        }
      })

      window.electronAPI.llm.chat(messages, config).catch((e: Error) => {
        removeChunk()
        removeError()
        removeComplete()
        controller.error(e)
      })
    },
    cancel() {
      window.electronAPI.llm.cancelChat()
    },
  })
}
