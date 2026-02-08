import { ipcMain, dialog } from 'electron'

/**
 * 注册所有 IPC handlers
 * 在主进程入口 (index.ts) 的 app.whenReady() 中调用
 */
export function registerIpcHandlers(): void {
  // ========================================
  // MCP 文件操作 handlers (返回 mock 数据)
  // ========================================

  ipcMain.handle('mcp:list-files', async (_event, path: string) => {
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

  ipcMain.handle('mcp:read-file', async (_event, path: string) => {
    console.log(`[IPC] mcp:read-file called with path: ${path}`)
    // TODO: Phase 2 将实现真实的文件读取
    return new ArrayBuffer(0)
  })

  ipcMain.handle('mcp:write-file', async (_event, path: string, content: string) => {
    console.log(`[IPC] mcp:write-file called with path: ${path}, content length: ${content.length}`)
    // TODO: Phase 2 将实现真实的文件写入
    return
  })

  ipcMain.handle('mcp:move-file', async (_event, source: string, destination: string) => {
    console.log(`[IPC] mcp:move-file called from ${source} to ${destination}`)
    // TODO: Phase 2 将实现真实的文件移动
    return
  })

  // ========================================
  // LLM 聊天 handlers (返回 mock 数据)
  // ========================================

  ipcMain.handle('llm:chat', async (event, messages: unknown[]) => {
    console.log(`[IPC] llm:chat called with ${Array.isArray(messages) ? messages.length : 0} messages`)
    // TODO: Phase 4 将实现真实的 LLM API 调用

    // Mock 流式响应
    const mockResponse = '这是一个 mock 响应。Phase 4 将集成真实的 LLM API。'
    const chunks = mockResponse.split('')

    for (const chunk of chunks) {
      // 模拟流式输出
      await new Promise((resolve) => setTimeout(resolve, 50))
      event.sender.send('llm:chat-chunk', chunk)
    }

    // 发送完成信号
    event.sender.send('llm:chat-chunk', '[DONE]')
  })

  // ========================================
  // 应用工具 handlers
  // ========================================

  ipcMain.handle('app:select-directory', async () => {
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

  ipcMain.handle('app:get-safe-storage', async (_event, key: string) => {
    console.log(`[IPC] app:get-safe-storage called with key: ${key}`)
    // TODO: 实现 safeStorage 读取
    return null
  })

  ipcMain.handle('app:set-safe-storage', async (_event, key: string, value: string) => {
    console.log(`[IPC] app:set-safe-storage called with key: ${key}`)
    // TODO: 实现 safeStorage 写入
    return
  })

  console.log('[IPC] All handlers registered successfully')
}
