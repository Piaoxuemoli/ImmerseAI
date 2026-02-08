import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// 定义 IPC 通信接口类型
export interface ElectronAPI {
  // MCP 文件操作
  mcp: {
    listFiles: (path: string) => Promise<unknown>
    readFile: (path: string) => Promise<unknown>
    writeFile: (path: string, content: string) => Promise<void>
    moveFile: (source: string, destination: string) => Promise<void>
  }

  // LLM 聊天
  llm: {
    chat: (messages: unknown[], onChunk: (chunk: string) => void) => Promise<void>
  }

  // 应用工具
  app: {
    selectDirectory: () => Promise<string | null>
    getSafeStorage: (key: string) => Promise<string | null>
    setSafeStorage: (key: string, value: string) => Promise<void>
  }
}

// 通过 contextBridge 暴露安全的 API 给渲染进程
const electronAPI: ElectronAPI = {
  mcp: {
    listFiles: (path: string) => ipcRenderer.invoke('mcp:list-files', path),
    readFile: (path: string) => ipcRenderer.invoke('mcp:read-file', path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('mcp:write-file', path, content),
    moveFile: (source: string, destination: string) =>
      ipcRenderer.invoke('mcp:move-file', source, destination)
  },

  llm: {
    chat: (messages: unknown[], onChunk: (chunk: string) => void) => {
      // 先移除可能存在的旧监听器
      ipcRenderer.removeAllListeners('llm:chat-chunk')

      // 监听流式响应
      ipcRenderer.on('llm:chat-chunk', (_event: IpcRendererEvent, chunk: string) => {
        onChunk(chunk)
      })

      // 发起请求
      return ipcRenderer.invoke('llm:chat', messages)
    }
  },

  app: {
    selectDirectory: () => ipcRenderer.invoke('app:select-directory'),
    getSafeStorage: (key: string) => ipcRenderer.invoke('app:get-safe-storage', key),
    setSafeStorage: (key: string, value: string) =>
      ipcRenderer.invoke('app:set-safe-storage', key, value)
  }
}

// 暴露 API 到渲染进程的 window 对象
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
