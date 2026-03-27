## 1. MCP 连接 IPC 与 Preload

- [x] 1.1 在 `electron/main/ipc-handlers.ts` 中新增 `mcp:connect` handler，调用 `McpManager.getInstance().connectLocal(path)`，try-catch 捕获 McpConnectionError 并 reject 可读错误
- [x] 1.2 在 `ipc-handlers.ts` 中新增 `mcp:disconnect` handler，调用 `McpManager.getInstance().disconnect()`
- [x] 1.3 在 `ipc-handlers.ts` 中新增 `mcp:get-status` handler，调用 `McpManager.getInstance().getStatus()`，返回 `{ status, currentPath }`
- [x] 1.4 为现有 MCP handlers（list-files、read-file、write-file、move-file、create-directory、delete-file）增加最外层 try-catch，错误通过 reject 返回可读信息
- [x] 1.5 在 `electron/preload/index.ts` 的 mcp 对象上新增 `connect(path: string): Promise<void>`、`disconnect(): Promise<void>`、`getStatus(): Promise<{ status: string; currentPath: string | null }>`
- [x] 1.6 在 `src/shared/types/electron.d.ts` 的 `ElectronAPI.mcp` 中新增上述三个方法签名

## 2. useBookshelf Hook

- [x] 2.1 创建 `src/features/bookshelf/hooks/useBookshelf.ts`，从 Store 读取 books、connectionStatus、bookshelfRootPath 及 setBooks、setConnectionStatus、setBookshelfRootPath
- [x] 2.2 实现 `mountBookshelf()`：selectDirectory → 用户取消则 return；否则 setConnectionStatus('connecting') → mcp.connect(path) → mcp.listFiles(path) → 过滤 .epub 并转为 Book[]（id=uuid, title=文件名去后缀, author='未知作者', path, isIndexed=false）→ setBooks + setBookshelfRootPath + setConnectionStatus('connected')；错误时 setConnectionStatus('error') 并设置 error 状态
- [x] 2.3 实现 `refreshBooks()`：当已连接且 bookshelfRootPath 非空时 listFiles → 转 Book[] → setBooks，isLoading 管理
- [x] 2.4 实现 `unmountBookshelf()`：mcp.disconnect() → setBooks([])、setBookshelfRootPath('')、setConnectionStatus('disconnected')
- [x] 2.5 Hook 返回 { books, connectionStatus, isLoading, error, mountBookshelf, unmountBookshelf, refreshBooks }，所有异步路径 try-catch

## 3. BookshelfPage 与数据源

- [x] 3.1 在 BookshelfPage 中删除 MOCK_BOOKS（或 fallback），改为仅使用 `useBookshelf()` 的 books、connectionStatus、isLoading、error、mountBookshelf
- [x] 3.2 实现未连接状态 UI：当 connectionStatus 为 disconnected 或 bookshelfRootPath 为空时，展示引导挂载（提示选择目录 + 可点击触发 mountBookshelf）
- [x] 3.3 实现加载中状态 UI：当 isLoading 为 true 时展示 Skeleton 或 loading
- [x] 3.4 实现已加载有书：connectionStatus === 'connected' 且 books.length > 0 时渲染 BookGrid，传入 books 与 onBookClick
- [x] 3.5 实现空书架状态：connectionStatus === 'connected' 且 books.length === 0 时展示 Empty state（引导文案 + Add 卡片）

## 4. BookGrid 与 BookCard 点击导航

- [x] 4.1 BookGrid 接收 `onBookClick: (bookId: string) => void` prop，并传递给每个 BookCard 的 onClick
- [x] 4.2 在 BookshelfPage 中实现 onBookClick：调用 store.selectBook(bookId) 并 navigate(`/reader/${bookId}`)，需使用 useNavigate 与 useStore

## 5. TopBar 回调与导航

- [x] 5.1 TopBar 接收 onSettingsClick、onImportClick（及可选 onGitHubClick）回调 props
- [x] 5.2 BookshelfPage 中 Settings 按钮触发 navigate('/settings')（通过 onSettingsClick 或直接传入 navigate）
- [x] 5.3 Import 按钮触发 mountBookshelf()（通过 onImportClick 传入 useBookshelf 的 mountBookshelf）
- [x] 5.4 GitHub 按钮触发 window.open('https://github.com/...') 或等价外链

## 6. 设置页对齐

- [x] 6.1 将设置页 API Key 的 safeStorage key 从 `llm-api-key` 改为 `llm_api_key`（getSafeStorage / setSafeStorage），与 llm-handler 一致
- [x] 6.2 确认设置页书架路径展示与更换使用 Store 的 bookshelfRootPath 与 setBookshelfRootPath，空时显示「未挂载」或「未设置」
- [x] 6.3 确认设置页 LLM 配置（Provider、Base URL、Model、Temperature、MaxTokens）读写 Store 的 llmConfig，Provider 切换时按预设更新 baseUrl/model 默认值

## 7. 路由与验证

- [x] 7.1 确认 `src/app/router.tsx` 中已注册 `/settings` 路由并指向 SettingsPage
- [x] 7.2 运行 `npx tsc --noEmit` 确保 TypeScript 编译通过（修复本变更引入的任何类型错误）
