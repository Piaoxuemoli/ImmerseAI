# Phase 2 & Phase 4 补全 — Design

## Context

- **主进程**：`McpManager` 已实现 `connectLocal` / `disconnect` / `getStatus` / `listFiles` / `readFile` / `writeFile` / `moveFile` / `createDirectory` / `deleteFile`。`ipc-handlers.ts` 中 list/read/write/move/create/delete 已委托 McpManager，但 **connect / disconnect / getStatus 未暴露 IPC**，渲染进程无法主动挂载/卸载书架或查询连接状态。
- **Preload**：`electronAPI.mcp` 仅有 listFiles、readFile、writeFile、moveFile、createDirectory、deleteFile，缺少 connect、disconnect、getStatus。
- **书架**：BookshelfPage 当前用 `useStore` 取 books 并与 MOCK_BOOKS fallback，LibrarianBar 已接 useLibrarian 与真实 Agent；缺少「选择目录 → connect → listFiles → 转 Book[] 写 Store」的 useBookshelf 流程，以及未连接/加载中/空书架三种状态的 UI 与 TopBar/BookGrid 的导航联动。
- **Store**：已有 `books`、`connectionStatus`、`bookshelfRootPath`、`llmConfig`、对应 setters 及 persist。无需新增 state，只需 useBookshelf 与设置页正确读写。
- **设置页**：`SettingsPage.tsx` 已存在，需对齐 prompt-arsenal 的「必需能力」（Provider、API Key、Base URL、Model、Temperature、MaxTokens、书架路径、测试连接、返回）。
- **约束**：宪法 P-3 要求文件操作经 MCP，不直接用 Node fs；类型与 preload/ipc-handlers 一致；所有异步路径 try-catch。

## Goals / Non-Goals

**Goals:**

- 渲染进程可通过 `mcp.connect(path)` / `mcp.disconnect()` / `mcp.getStatus()` 管理 MCP 连接并与 Store 的 `connectionStatus` / `bookshelfRootPath` 一致。
- 提供 `useBookshelf`：mountBookshelf（选目录 → connect → listFiles → 转 Book[] 写 Store）、unmountBookshelf、refreshBooks；暴露 books、connectionStatus、isLoading、error。
- BookshelfPage 完全依赖 useBookshelf，支持未连接（引导挂载）、加载中（Skeleton）、已连接（BookGrid 或空书架 Empty state）；BookGrid/BookCard 支持 onBookClick → selectBook + navigate(`/reader/${bookId}`)；TopBar Settings/Import/GitHub 与 LibrarianBar 输入/发送骨架明确。
- 设置页具备 LLM 配置（Provider、API Key、Base URL、Model、Temperature、MaxTokens）、书架路径展示与更换、测试连接、返回；与 Store 和 safeStorage 一致。
- 所有 MCP 相关 IPC handler 统一 try-catch，错误可读并返回给渲染进程。

**Non-Goals:**

- 不改变 McpManager 内部实现；不新增 RAG/索引逻辑；不实现 Librarian Agent 新意图（仅复用现有 LibrarianBar/useLibrarian）。设置页不做高级配置（如代理、多环境），仅最小可用。

## Decisions

### D1: MCP 连接 API 形态

- **选择**：主进程新增 `mcp:connect`、`mcp:disconnect`、`mcp:get-status` 三个 handler，分别调用 `McpManager.getInstance().connectLocal(path)`、`disconnect()`、`getStatus()`。Preload 暴露 `mcp.connect(path: string): Promise<void>`、`mcp.disconnect(): Promise<void>`、`mcp.getStatus(): Promise<{ status: ConnectionStatus; currentPath: string | null }>`（与 McpStatus 对齐）。`electron.d.ts` 中 `ElectronAPI.mcp` 增加上述三方法。
- **理由**：连接生命周期由主进程 McpManager 唯一持有，渲染进程仅通过 IPC 触发与查询，避免多端状态不一致。getStatus 返回 currentPath 便于 UI 显示「当前挂载路径」。
- **备选**：在 preload 层缓存 status 并轮询主进程 — 增加复杂度且易与主进程真实状态不同步，不采用。

### D2: useBookshelf 与 Store 的职责划分

- **选择**：`useBookshelf` 内调用 `mcp.connect`/`disconnect`/`listFiles`，成功后调用 Store 的 `setBooks`、`setConnectionStatus`、`setBookshelfRootPath`；`books`、`connectionStatus`、`bookshelfRootPath` 从 Store 读取。不在 useBookshelf 内维护一份本地 books 副本。
- **理由**：单一数据源（Store），便于持久化与其它组件（如 LibrarianBar）共享；useBookshelf 仅负责「流程编排」与 isLoading/error 的局部状态。
- **备选**：useBookshelf 内部 state 存 books — 与 Store 重复且需同步，不采用。

### D3: Book 从 BookFile 的转换规则

- **选择**：listFiles 返回的 BookFile[] 过滤 `type === 'epub'`（或 path 以 .epub 结尾）；每条生成 `Book`：`id = crypto.randomUUID()`，`title` = 文件名去掉 `.epub`，`author = '未知作者'`，`path` = BookFile.path，`isIndexed = false`。不在此阶段解析 epub 元数据。
- **理由**：满足「书架列表可点、可进阅读器」的最小需求；元数据解析可后续在 RAG/索引或阅读器加载时再做。
- **备选**：在 mountBookshelf 时读 epub 取作者 — 增加延迟与复杂度，首版不做。

### D4: MCP Handler 错误处理

- **选择**：每个 MCP 相关 handler（含既有 list/read/write/move/create/delete 与新增 connect/disconnect/get-status）最外层 try-catch。捕获到 `McpConnectionError` 时，将 `code`、`message`、`retriesLeft` 序列化为可读信息通过 reject 返回；其它 Error 统一包装为 `{ message: error.message }` 或等价，保证渲染进程能展示。
- **理由**：主进程不崩溃，渲染进程可显示「连接失败」「权限错误」等；与现有 IPC 返回 Promise 的约定一致。
- **备选**：主进程仅 log、不包装 — 渲染端拿不到结构化错误，不采用。

### D5: 设置页与 Store 的字段对齐

- **选择**：设置页读写 Store 的 `llmConfig`（provider、baseUrl、model、temperature、maxTokens）与 `bookshelfRootPath`。API Key 继续用 `app.getSafeStorage('llm_api_key')` / `app.setSafeStorage('llm_api_key', value)`，不放入 Store。Provider 切换时用预设表更新 baseUrl/model 默认值（deepseek/kimi/moonshot/openai/custom），与 proposal 一致。
- **理由**：现有 Store 已有 llmConfig、bookshelfRootPath 且 persist；避免重复 state；safeStorage 专用于敏感 Key。
- **备选**：Store 再存 apiKey 占位 — 敏感信息不宜进 localStorage，不采用。

### D6: 书架「未连接」与「空书架」的 UI 区分

- **选择**：`connectionStatus === 'disconnected'` 或 `bookshelfRootPath` 为空时视为未连接，展示「引导挂载」（如提示选择目录 + 调用 mountBookshelf 的入口）。已连接且 `books.length === 0` 时展示 Empty state（如「拖入 EPUB 文件」+ Add 卡片）。加载中（mountBookshelf 或 refreshBooks 进行中）用 Skeleton 或 loading 状态。
- **理由**：用户能明确区分「还没选目录」与「已选目录但没有书」；符合宪法 6.2 Empty state 要求。
- **备选**：未连接也显示空书架样式 — 易混淆，不采用。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 用户取消目录选择后 connectionStatus 曾设为 connecting | mountBookshelf 在用户取消时直接 return，不设 connecting；仅在选择目录并调用 connect 前设为 connecting。 |
| listFiles 返回大量文件导致首屏慢 | 首版不限制数量；后续可加「仅扫描 .epub」或分页。 |
| getStatus 与真实连接不同步 | 仅以主进程 McpManager.getStatus() 为准，不缓存；需要时由渲染进程主动 invoke。 |
| 设置页与 llm-handler 使用的 key 不一致 | 统一使用 `llm_api_key`；设置页与 llm-handler 均以该 key 读写 safeStorage。 |

## Migration Plan

1. **实现顺序**：先 IPC + Preload + electron.d.ts（connect/disconnect/get-status），再 useBookshelf，再 BookshelfPage/BookGrid/TopBar/LibrarianBar 联动，最后设置页补全与路由检查。
2. **回退**：本变更为增量补全，不删除现有 MCP 文件操作；若问题可先回退 useBookshelf 与页面改动，保留 IPC 扩展；主进程 McpManager 本身不变。
3. **兼容**：Store 已含 bookshelfRootPath、llmConfig；若现有 SettingsPage 字段名不一致，仅改设置页组件以读写 Store 与 safeStorage，不改 Store 结构。

## Open Questions

- 无。若后续需要「卸载书架时是否清空 books 并重置 bookshelfRootPath」，在 useBookshelf 的 unmountBookshelf 内调用 disconnect 后执行 setBooks([])、setBookshelfRootPath('')、setConnectionStatus('disconnected') 即可，与当前设计一致。
