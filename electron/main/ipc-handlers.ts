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
import { McpManager, type FileEntry } from './mcp-manager'

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
  // MCP 文件操作 handlers (使用真实 MCP)
  // ========================================

  ipcMain.handle('mcp:list-files', async (_event, filePath: string): Promise<BookFile[]> => {
    console.log(`[IPC] mcp:list-files called with path: ${filePath}`)
    const entries = await McpManager.getInstance().listFiles(filePath)
    return entries
      .filter((e) => e.type === 'file')
      .map(convertToBookFile)
  })

  ipcMain.handle('mcp:read-file', async (_event, filePath: string): Promise<ArrayBuffer> => {
    console.log(`[IPC] mcp:read-file called with path: ${filePath}`)
    const result = await McpManager.getInstance().readFile(filePath)
    if (typeof result === 'string') {
      // 文本内容转为 ArrayBuffer
      const encoder = new TextEncoder()
      const uint8Array = encoder.encode(result)
      return uint8Array.buffer as ArrayBuffer
    }
    return result
  })

  ipcMain.handle('mcp:write-file', async (_event, filePath: string, content: string): Promise<void> => {
    console.log(`[IPC] mcp:write-file called with path: ${filePath}, content length: ${content.length}`)
    await McpManager.getInstance().writeFile(filePath, content)
  })

  ipcMain.handle('mcp:move-file', async (_event, source: string, destination: string): Promise<void> => {
    console.log(`[IPC] mcp:move-file called from ${source} to ${destination}`)
    await McpManager.getInstance().moveFile(source, destination)
  })

  ipcMain.handle('mcp:create-directory', async (_event, directoryPath: string): Promise<void> => {
    console.log(`[IPC] mcp:create-directory called with path: ${directoryPath}`)
    await McpManager.getInstance().createDirectory(directoryPath)
  })

  ipcMain.handle('mcp:delete-file', async (_event, filePath: string): Promise<void> => {
    console.log(`[IPC] mcp:delete-file called with path: ${filePath}`)
    await McpManager.getInstance().deleteFile(filePath)
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
