/**
 * IPC Handlers - Type-Safe Main Process Bridge
 * 
 * 类型安全约束：
 * - 所有类型从 @/shared/types/index.ts 导入，禁止使用 unknown/any
 * - 类型签名必须与 electron/preload/index.ts 完全一致
 */

import { ipcMain, dialog } from 'electron'
import type { BookFile, Message, LlmConfig } from '@/shared/types'
import { handleLlmChat } from './llm-handler'
import { getSafeStorageValue, setSafeStorageValue } from './safe-storage'

/**
 * 注册所有 IPC handlers
 * 在主进程入口 (index.ts) 的 app.whenReady() 中调用
 */
export function registerIpcHandlers(): void {
  // ========================================
  // MCP 文件操作 handlers (返回 mock 数据)
  // ========================================

  ipcMain.handle('mcp:list-files', async (_event, path: string): Promise<BookFile[]> => {
    console.log(`[IPC] mcp:list-files called with path: ${path}`)
    // TODO: Phase 2 将实现真实的 MCP 调用
    return [
      {
        name: '三体.epub',
        path: '/books/三体.epub',
        size: 1024000,
        type: 'epub',
        lastModified: Date.now()
      },
      {
        name: '活着.epub',
        path: '/books/活着.epub',
        size: 512000,
        type: 'epub',
        lastModified: Date.now()
      }
    ]
  })

  ipcMain.handle('mcp:read-file', async (_event, path: string): Promise<ArrayBuffer> => {
    console.log(`[IPC] mcp:read-file called with path: ${path}`)
    // TODO: Phase 2 将实现真实的文件读取
    return new ArrayBuffer(0)
  })

  ipcMain.handle('mcp:write-file', async (_event, path: string, content: string): Promise<void> => {
    console.log(`[IPC] mcp:write-file called with path: ${path}, content length: ${content.length}`)
    // TODO: Phase 2 将实现真实的文件写入
    return
  })

  ipcMain.handle('mcp:move-file', async (_event, source: string, destination: string): Promise<void> => {
    console.log(`[IPC] mcp:move-file called from ${source} to ${destination}`)
    // TODO: Phase 2 将实现真实的文件移动
    return
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
