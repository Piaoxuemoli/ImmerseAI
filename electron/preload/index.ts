/**
 * Preload Script - Type-Safe IPC Bridge
 *
 * 类型安全约束：
 * - 所有类型从 @/shared/types/index.ts 导入，禁止使用 unknown/any
 * - 类型签名必须与 electron/main/ipc-handlers.ts 完全一致
 * - 类型定义必须与 src/shared/types/electron.d.ts 同步
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { BookFile, Message, LlmConfig, RagParagraph, RagSearchResult } from '@/shared/types'
import type { ElectronAPI } from '@/shared/types/electron'

const electronAPI: ElectronAPI = {
  mcp: {
    connect: (path: string): Promise<void> =>
      ipcRenderer.invoke('mcp:connect', path),
    disconnect: (): Promise<void> =>
      ipcRenderer.invoke('mcp:disconnect'),
    getStatus: (): Promise<{ status: string; currentPath: string | null }> =>
      ipcRenderer.invoke('mcp:get-status'),
    listFiles: (path: string): Promise<BookFile[]> =>
      ipcRenderer.invoke('mcp:list-files', path),
    readFile: (path: string): Promise<ArrayBuffer> =>
      ipcRenderer.invoke('mcp:read-file', path),
    writeFile: (path: string, content: string): Promise<void> =>
      ipcRenderer.invoke('mcp:write-file', path, content),
    moveFile: (source: string, destination: string): Promise<void> =>
      ipcRenderer.invoke('mcp:move-file', source, destination),
    createDirectory: (path: string): Promise<void> =>
      ipcRenderer.invoke('mcp:create-directory', path),
    deleteFile: (path: string): Promise<void> =>
      ipcRenderer.invoke('mcp:delete-file', path),
  },

  llm: {
    chat: (messages: Message[], config: LlmConfig): Promise<void> =>
      ipcRenderer.invoke('llm:chat', messages, config),
    onChunk: (callback: (chunk: string) => void): (() => void) => {
      const listener = (_: unknown, chunk: string): void => callback(chunk)
      ipcRenderer.on('llm:chat-chunk', listener)
      return () => ipcRenderer.removeListener('llm:chat-chunk', listener)
    },
    onError: (callback: (err: { code: string; message: string }) => void): (() => void) => {
      const listener = (_: unknown, err: { code: string; message: string }): void => callback(err)
      ipcRenderer.on('llm:chat-error', listener)
      return () => ipcRenderer.removeListener('llm:chat-error', listener)
    },
    cancelChat: (): void => {
      ipcRenderer.removeAllListeners('llm:chat-chunk')
      ipcRenderer.removeAllListeners('llm:chat-error')
    },
  },

  app: {
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('app:select-directory'),
    selectFiles: (): Promise<string[]> =>
      ipcRenderer.invoke('app:select-files'),
    readFileText: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('app:read-file-text', filePath),
    getSafeStorage: (key: string): Promise<string> =>
      ipcRenderer.invoke('app:get-safe-storage', key),
    setSafeStorage: (key: string, value: string): Promise<boolean> =>
      ipcRenderer.invoke('app:set-safe-storage', key, value),
  },

  rag: {
    ingest: (bookId: string, paragraphs: RagParagraph[]): void =>
      ipcRenderer.send('rag:ingest', { bookId, paragraphs }),

    search: (contentHash: string, query: string, topK = 5): Promise<RagSearchResult[]> =>
      ipcRenderer.invoke('rag:search', { contentHash, query, topK }),

    status: (contentHash: string): Promise<boolean> =>
      ipcRenderer.invoke('rag:status', contentHash),

    clearCache: (contentHash: string): Promise<void> =>
      ipcRenderer.invoke('rag:clear-cache', contentHash),

    onIngestProgress: (
      callback: (data: { bookId: string; progress: number }) => void,
    ): (() => void) => {
      const listener = (_: unknown, data: { bookId: string; progress: number }): void =>
        callback(data)
      ipcRenderer.on('rag:ingest-progress', listener)
      return () => ipcRenderer.removeListener('rag:ingest-progress', listener)
    },

    onIngestComplete: (
      callback: (data: {
        bookId: string
        contentHash: string
        chunkCount: number
        mode?: 'semantic' | 'lexical' | 'hybrid'
      }) => void,
    ): (() => void) => {
      const listener = (
        _: unknown,
        data: { bookId: string; contentHash: string; chunkCount: number; mode?: 'semantic' | 'lexical' | 'hybrid' },
      ): void => callback(data)
      ipcRenderer.on('rag:ingest-complete', listener)
      return () => ipcRenderer.removeListener('rag:ingest-complete', listener)
    },

    onUpgradeProgress: (
      callback: (data: { bookId: string; progress: number }) => void,
    ): (() => void) => {
      const listener = (_: unknown, data: { bookId: string; progress: number }): void =>
        callback(data)
      ipcRenderer.on('rag:upgrade-progress', listener)
      return () => ipcRenderer.removeListener('rag:upgrade-progress', listener)
    },

    onUpgradeComplete: (
      callback: (data: { bookId: string; chunkCount: number }) => void,
    ): (() => void) => {
      const listener = (_: unknown, data: { bookId: string; chunkCount: number }): void =>
        callback(data)
      ipcRenderer.on('rag:upgrade-complete', listener)
      return () => ipcRenderer.removeListener('rag:upgrade-complete', listener)
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
