/**
 * Electron API 全局类型声明
 *
 * 类型定义必须与 electron/preload/index.ts 中的实现完全一致
 */

import type { BookFile, Message, LlmConfig, RagParagraph, RagSearchResult } from './index'

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
    connect: (path: string) => Promise<void>
    disconnect: () => Promise<void>
    getStatus: () => Promise<{ status: string; currentPath: string | null }>
    listFiles: (path: string) => Promise<BookFile[]>
    readFile: (path: string) => Promise<ArrayBuffer>
    writeFile: (path: string, content: string) => Promise<void>
    moveFile: (source: string, destination: string) => Promise<void>
    createDirectory: (path: string) => Promise<void>
    deleteFile: (path: string) => Promise<void>
  }

  // LLM 聊天
  llm: {
    chat: (messages: Message[], config: LlmConfig) => Promise<void>
    onChunk: (callback: (chunk: string) => void) => () => void
    onError: (callback: (err: { code: string; message: string }) => void) => () => void
    cancelChat: () => void
  }

  // 应用工具
  app: {
    selectDirectory: () => Promise<string | null>
    selectFiles: () => Promise<string[]>
    readFileText: (filePath: string) => Promise<string>
    getSafeStorage: (key: string) => Promise<string>
    setSafeStorage: (key: string, value: string) => Promise<boolean>
    getUserDataPath: () => Promise<string>
  }

  // RAG 检索（主进程实现，无 file:// 限制）
  rag: {
    /** 触发书籍索引（单向，进度通过 onIngestProgress/onIngestComplete 回调） */
    ingest: (bookId: string, paragraphs: RagParagraph[]) => void
    /** 检索相关片段 */
    search: (contentHash: string, query: string, topK?: number) => Promise<RagSearchResult[]>
    /** 检查指定内容哈希的缓存是否存在 */
    status: (contentHash: string) => Promise<boolean>
    /** 清除指定书籍的 RAG 缓存 */
    clearCache: (contentHash: string) => Promise<void>
    /** 监听索引进度（0-100） */
    onIngestProgress: (
      callback: (data: { bookId: string; progress: number }) => void,
    ) => () => void
    /** 监听索引完成（含 contentHash、chunkCount 和 mode） */
    onIngestComplete: (
      callback: (data: {
        bookId: string
        contentHash: string
        chunkCount: number
        mode?: 'semantic' | 'lexical' | 'hybrid'
      }) => void,
    ) => () => void
    /** 监听后台语义升级进度（0-100，仅大书触发） */
    onUpgradeProgress: (
      callback: (data: { bookId: string; progress: number }) => void,
    ) => () => void
    /** 监听后台语义升级完成 */
    onUpgradeComplete: (
      callback: (data: { bookId: string; chunkCount: number }) => void,
    ) => () => void
  }

  // Skill 文件操作
  skills: {
    /** 列出目录下所有 .md 文件 */
    list: (dirPath: string) => Promise<string[]>
    /** 读取 skill 文件内容 */
    read: (filePath: string) => Promise<string>
    /** 写入 skill 文件（自动创建目录） */
    write: (filePath: string, content: string) => Promise<void>
  }
}
