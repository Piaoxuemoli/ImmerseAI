/**
 * IPC Handlers - Type-Safe Main Process Bridge
 * 
 * 类型安全约束：
 * - 所有类型从 @/shared/types/index.ts 导入，禁止使用 unknown/any
 * - 类型签名必须与 electron/preload/index.ts 完全一致
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { ipcMain, dialog } from 'electron'
import type { BookFile, Message, LlmConfig } from '@/shared/types'
import { handleLlmChat } from './llm-handler'
import { getSafeStorageValue, setSafeStorageValue } from './safe-storage'
import { McpManager, McpConnectionError, type FileEntry, type McpStatus } from './mcp-manager'
import { ragIngest, ragSearch, ragStatus, ragClearCache } from './rag-handler'
import type { RagParagraph } from './rag-handler'

const abortControllers = new Map<string, AbortController>()

/**
 * 获取目录下所有 .md 文件
 */
async function getSkillMarkdownFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
      .map(entry => entry.name)
  } catch {
    return []
  }
}

/**
 * 确保目录存在（递归创建）
 */
async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

/**
 * 将 MCP 错误包装为可读信息
 */
function wrapMcpError(error: unknown): Error {
  if (error instanceof McpConnectionError) {
    return new Error(`[${error.code}] ${error.message} (剩余重试: ${error.retriesLeft})`)
  }
  if (error instanceof Error) {
    return error
  }
  return new Error(String(error))
}

/**
 * 将 FileEntry 转换为 BookFile 类型
 */
function convertToBookFile(entry: FileEntry): BookFile {
  let fileType: BookFile['type'] = entry.type
  if (entry.type === 'unknown') {
    const ext = path.extname(entry.name).toLowerCase().slice(1)
    if (ext === 'epub') fileType = 'epub'
    else if (ext === 'pdf') fileType = 'pdf'
    else if (ext === 'txt') fileType = 'txt'
    else if (ext === 'md') fileType = 'md'
  }

  return {
    name: entry.name,
    path: entry.path,
    size: entry.size,
    type: fileType,
    lastModified: entry.lastModified,
  }
}

/**
 * 注册所有 IPC handlers
 * 在主进程入口 (index.ts) 的 app.whenReady() 中调用
 */
export function registerIpcHandlers(): void {
  // ========================================
  // MCP 连接生命周期 handlers
  // ========================================

  ipcMain.handle('mcp:connect', async (_event, dirPath: string): Promise<void> => {
    console.log(`[IPC] mcp:connect called with path: ${dirPath}`)
    try {
      await McpManager.getInstance().connectLocal(dirPath)
    } catch (error) {
      throw wrapMcpError(error)
    }
  })

  ipcMain.handle('mcp:disconnect', async (): Promise<void> => {
    console.log(`[IPC] mcp:disconnect called`)
    try {
      await McpManager.getInstance().disconnect()
    } catch (error) {
      throw wrapMcpError(error)
    }
  })

  ipcMain.handle('mcp:get-status', async (): Promise<{ status: string; currentPath: string | null }> => {
    console.log(`[IPC] mcp:get-status called`)
    const mcpStatus: McpStatus = McpManager.getInstance().getStatus()
    return {
      status: mcpStatus.status,
      currentPath: mcpStatus.currentPath
    }
  })

  // ========================================
  // MCP 文件操作 handlers (使用真实 MCP)
  // ========================================

  ipcMain.handle('mcp:list-files', async (_event, filePath: string): Promise<BookFile[]> => {
    console.log(`[IPC] mcp:list-files called with path: ${filePath}`)
    try {
      const entries = await McpManager.getInstance().listFiles(filePath)
      return entries.map(convertToBookFile)
    } catch (error) {
      throw wrapMcpError(error)
    }
  })

  ipcMain.handle('mcp:read-file', async (_event, filePath: string): Promise<ArrayBuffer> => {
    console.log(`[IPC] mcp:read-file called with path: ${filePath}`)
    try {
      const result = await McpManager.getInstance().readFile(filePath)
      if (typeof result === 'string') {
        // 文本内容转为 ArrayBuffer
        const encoder = new TextEncoder()
        const uint8Array = encoder.encode(result)
        return uint8Array.buffer as ArrayBuffer
      }
      return result
    } catch (error) {
      throw wrapMcpError(error)
    }
  })

  ipcMain.handle('mcp:write-file', async (_event, filePath: string, content: string): Promise<void> => {
    console.log(`[IPC] mcp:write-file called with path: ${filePath}, content length: ${content.length}`)
    try {
      await McpManager.getInstance().writeFile(filePath, content)
    } catch (error) {
      throw wrapMcpError(error)
    }
  })

  ipcMain.handle('mcp:move-file', async (_event, source: string, destination: string): Promise<void> => {
    console.log(`[IPC] mcp:move-file called from ${source} to ${destination}`)
    try {
      await McpManager.getInstance().moveFile(source, destination)
    } catch (error) {
      throw wrapMcpError(error)
    }
  })

  ipcMain.handle('mcp:create-directory', async (_event, directoryPath: string): Promise<void> => {
    console.log(`[IPC] mcp:create-directory called with path: ${directoryPath}`)
    try {
      await McpManager.getInstance().createDirectory(directoryPath)
    } catch (error) {
      throw wrapMcpError(error)
    }
  })

  ipcMain.handle('mcp:delete-file', async (_event, filePath: string): Promise<void> => {
    console.log(`[IPC] mcp:delete-file called with path: ${filePath}`)
    try {
      await McpManager.getInstance().deleteFile(filePath)
    } catch (error) {
      throw wrapMcpError(error)
    }
  })

  // ========================================
  // LLM 聊天 handlers (返回 mock 数据)
  // ========================================

  ipcMain.handle('llm:chat', async (event, messages: Message[], config: LlmConfig): Promise<void> => {
    try {
      await handleLlmChat(event, messages, config)
    } catch (error) {
      console.error('[IPC] llm:chat handler exception:', error)
      const code = error instanceof Error ? error.constructor.name : 'unknown'
      const message = error instanceof Error ? error.message : String(error)
      if (!event.sender.isDestroyed()) {
        event.sender.send('llm:chat-error', { code, message })
        event.sender.send('llm:chat-complete', { totalDuration: 0 })
      }
    }
  })

  // ========================================
  // 应用工具 handlers
  // ========================================

  ipcMain.handle('app:select-directory', async (): Promise<string | null> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择书架目录',
        buttonLabel: '选择'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return result.filePaths[0]
    } catch (error) {
      console.error('[IPC] app:select-directory error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  })

  ipcMain.handle('app:read-file-text', async (_event, filePath: string): Promise<string> => {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      console.error('[IPC] app:read-file-text error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  })

  ipcMain.handle('app:select-files', async (): Promise<string[]> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        title: '选择书籍文件',
        buttonLabel: '导入',
        filters: [
          { name: '书籍文件', extensions: ['md', 'txt'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      })

      if (result.canceled) return []
      return result.filePaths
    } catch (error) {
      console.error('[IPC] app:select-files error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  })

  ipcMain.handle('app:get-safe-storage', async (_event, key: string): Promise<string> => {
    try {
      return getSafeStorageValue(key)
    } catch (error) {
      console.error('[IPC] app:get-safe-storage error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  })

  ipcMain.handle('app:set-safe-storage', async (_event, key: string, value: string): Promise<boolean> => {
    try {
      return setSafeStorageValue(key, value)
    } catch (error) {
      console.error('[IPC] app:set-safe-storage error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  })

  // ========================================
  // RAG handlers (主进程 RAG — 彻底规避 file:// 限制)
  // ========================================

  // 索引书籍（单向推送进度/完成事件）
  ipcMain.on('rag:ingest', (event, data: { bookId: string; paragraphs: RagParagraph[] }) => {
    const { bookId, paragraphs } = data
    console.log(`[IPC] rag:ingest called for book: ${bookId}, paragraphs: ${paragraphs.length}`)
    // Cancel any existing ingest for this book
    const existing = abortControllers.get(bookId)
    if (existing) existing.abort()
    const controller = new AbortController()
    abortControllers.set(bookId, controller)

    ragIngest(bookId, paragraphs, event.sender, controller.signal).then(() => {
      abortControllers.delete(bookId)
    }).catch((error) => {
      abortControllers.delete(bookId)
      if (error.message === 'Cancelled') return
      console.error('[IPC] rag:ingest error:', error)
      event.sender.send('rag:ingest-error', {
        bookId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  })

  // 取消正在进行的索引
  ipcMain.on('rag:cancel', (_, bookId: string) => {
    const controller = abortControllers.get(bookId)
    if (controller) {
      controller.abort()
      abortControllers.delete(bookId)
      console.log(`[IPC] rag:cancel for book: ${bookId}`)
    }
  })

  // 检索（返回结果）
  ipcMain.handle(
    'rag:search',
    async (_, data: { contentHash: string; query: string; topK?: number }) => {
      try {
        return await ragSearch(data.contentHash, data.query, data.topK ?? 5)
      } catch (error) {
        console.error('[IPC] rag:search error:', error)
        throw error instanceof Error ? error : new Error(String(error))
      }
    },
  )

  // 检查缓存是否存在
  ipcMain.handle('rag:status', async (_, contentHash: string) => {
    try {
      return await ragStatus(contentHash)
    } catch (error) {
      console.error('[IPC] rag:status error:', error)
      return false
    }
  })

  // 清除指定书籍的缓存
  ipcMain.handle('rag:clear-cache', async (_, contentHash: string) => {
    try {
      await ragClearCache(contentHash)
    } catch (error) {
      console.error('[IPC] rag:clear-cache error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  })

  // ========================================
  // Skill 文件操作 handlers
  // ========================================

  // 列出目录下所有 .md 文件
  ipcMain.handle('skills:list', async (_, dirPath: string) => {
    console.log(`[IPC] skills:list called with path: ${dirPath}`)
    try {
      return await getSkillMarkdownFiles(dirPath)
    } catch (error) {
      console.error('[IPC] skills:list error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  })

  // 读取 skill 文件内容
  ipcMain.handle('skills:read', async (_, filePath: string) => {
    console.log(`[IPC] skills:read called with path: ${filePath}`)
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      console.error('[IPC] skills:read error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  })

  // 写入 skill 文件（自动创建目录）
  ipcMain.handle('skills:write', async (_, filePath: string, content: string) => {
    console.log(`[IPC] skills:write called with path: ${filePath}, content length: ${content.length}`)
    try {
      await ensureDir(path.dirname(filePath))
      await fs.writeFile(filePath, content, 'utf-8')
    } catch (error) {
      console.error('[IPC] skills:write error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  })

  console.log('[IPC] All handlers registered successfully')
}
