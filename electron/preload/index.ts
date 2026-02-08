/**
 * Preload Script - Type-Safe IPC Bridge
 * 
 * 类型安全约束：
 * - 所有类型从 @/shared/types/index.ts 导入，禁止使用 unknown/any
 * - 类型签名必须与 electron/main/ipc-handlers.ts 完全一致
 * - 类型定义必须与 src/shared/types/electron.d.ts 同步
 */
 
import { contextBridge, ipcRenderer } from 'electron'
import type { BookFile, Message, LlmConfig } from '@/shared/types'
import type { ElectronAPI } from '@/shared/types/electron'

// 通过 contextBridge 暴露安全的 API 给渲染进程
const electronAPI: ElectronAPI = {
  mcp: {
    listFiles: (path: string): Promise<BookFile[]> => 
      ipcRenderer.invoke('mcp:list-files', path),
    readFile: (path: string): Promise<ArrayBuffer> => 
      ipcRenderer.invoke('mcp:read-file', path),
    writeFile: (path: string, content: string): Promise<void> =>
      ipcRenderer.invoke('mcp:write-file', path, content),
    moveFile: (source: string, destination: string): Promise<void> =>
      ipcRenderer.invoke('mcp:move-file', source, destination)
  },

  llm: {
    chat: (messages: Message[], config: LlmConfig): Promise<ReadableStream<string>> => {
      return new Promise((resolve, reject) => {
        // 创建 ReadableStream 封装 IPC 事件流
        const stream = new ReadableStream<string>({
          start(controller) {
            const listener = (_: any, chunk: string) => {
              if (chunk === '[DONE]') {
                controller.close()
                ipcRenderer.removeListener('llm:chat-chunk', listener)
              } else {
                controller.enqueue(chunk)
              }
            }

            ipcRenderer.on('llm:chat-chunk', listener)

            // 发起 IPC 调用
            ipcRenderer.invoke('llm:chat', messages, config)
              .catch((err) => {
                controller.error(err)
                ipcRenderer.removeListener('llm:chat-chunk', listener)
                reject(err)
              })
          }
        })

        resolve(stream)
      })
    }
  },

  app: {
    selectDirectory: (): Promise<string | null> => 
      ipcRenderer.invoke('app:select-directory'),
    getSafeStorage: (key: string): Promise<string> => 
      ipcRenderer.invoke('app:get-safe-storage', key),
    setSafeStorage: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('app:set-safe-storage', key, value)
  }
}

// 暴露 API 到渲染进程的 window 对象
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
