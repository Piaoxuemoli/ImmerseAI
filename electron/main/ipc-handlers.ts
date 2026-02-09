/**
 * IPC Handlers - Type-Safe Main Process Bridge
 * 
 * 类型安全约束：
 * - 所有类型从 @/shared/types/index.ts 导入，禁止使用 unknown/any
 * - 类型签名必须与 electron/preload/index.ts 完全一致
 */

import path from 'node:path'
import { ipcMain, dialog } from 'electron'
import type { BookFile, Message, LlmConfig } from '@/shared/types'
import { handleLlmChat } from './llm-handler'
import { getSafeStorageValue, setSafeStorageValue } from './safe-storage'
import { McpManager, McpConnectionError, type FileEntry, type McpStatus } from './mcp-manager'

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
  const ext = path.extname(entry.name).toLowerCase().slice(1)
  let fileType: BookFile['type'] = 'unknown'
  if (ext === 'epub') fileType = 'epub'
  else if (ext === 'pdf') fileType = 'pdf'
  else if (ext === 'txt') fileType = 'txt'

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
      return entries
        .filter((e) => e.type === 'file')
        .map(convertToBookFile)
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
    await handleLlmChat(event, messages, config)
  })

  // ========================================
  // 应用工具 handlers
  // ========================================

  ipcMain.handle('app:select-directory', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择书架目录',
      buttonLabel: '选择'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('app:get-safe-storage', async (_event, key: string): Promise<string> => {
    return getSafeStorageValue(key)
  })

  ipcMain.handle('app:set-safe-storage', async (_event, key: string, value: string): Promise<boolean> => {
    return setSafeStorageValue(key, value)
  })

  console.log('[IPC] All handlers registered successfully')
}
