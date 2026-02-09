/**
 * Electron API 全局类型声明
 * 
 * 类型定义必须与 electron/preload/index.ts 中的实现完全一致
 */

import type { BookFile, Message, LlmConfig } from './index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

/**
 * Electron IPC API 接口定义
 * 此接口与 electron/preload/index.ts 中的 ElectronAPI 导出保持同步
 */
export interface ElectronAPI {
  // MCP 连接生命周期与文件操作
  mcp: {
    // 连接生命周期
    connect: (path: string) => Promise<void>
    disconnect: () => Promise<void>
    getStatus: () => Promise<{ status: string; currentPath: string | null }>
    // 文件操作
    listFiles: (path: string) => Promise<BookFile[]>
    readFile: (path: string) => Promise<ArrayBuffer>
    writeFile: (path: string, content: string) => Promise<void>
    moveFile: (source: string, destination: string) => Promise<void>
    createDirectory: (path: string) => Promise<void>
    deleteFile: (path: string) => Promise<void>
  }

  // LLM 聊天
  llm: {
    chat: (messages: Message[], config: LlmConfig) => Promise<ReadableStream<string>>
  }

  // 应用工具
  app: {
    selectDirectory: () => Promise<string | null>
    getSafeStorage: (key: string) => Promise<string>
    setSafeStorage: (key: string, value: string) => Promise<boolean>
  }
}

