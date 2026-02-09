# Phase 2 & Phase 4 补全 — Proposal

## Why

Phase 2 的 McpManager 与部分 IPC 已实现（librarian-agent 已接通 list/read/write/move/create/delete），但 **MCP 连接生命周期**（connect / disconnect / getStatus）未暴露给渲染进程，书架页仍依赖 mock 或静态数据，无法完成「选择目录 → 连接 MCP → 拉取书籍列表 → 点击进入阅读」的完整链路。Phase 4 的 LLM/Chat/Reader 已可用，但用户需能通过 **设置页** 配置 API Key 与书架路径并验证连接。本变更将上述断裂的管道接通，使书架与设置达到最小可用状态。

## What Changes

- **IPC 与 Preload**
  - 新增 `mcp:connect` / `mcp:disconnect` / `mcp:get-status` handlers，委托给 `McpManager.getInstance()`；所有 MCP 相关 handler 统一 try-catch，捕获 `McpConnectionError` 并返回可读错误。
  - Preload 暴露 `mcp.connect(path)`、`mcp.disconnect()`、`mcp.getStatus()`；`electron.d.ts` 补充对应类型。
- **书架业务逻辑**
  - 新增 `useBookshelf` hook：提供 `books`、`connectionStatus`、`isLoading`、`error`、`mountBookshelf()`、`unmountBookshelf()`、`refreshBooks()`。`mountBookshelf` 流程：选择目录 → connect → listFiles → 过滤 .epub → 转为 `Book[]` 写入 Store 并更新 `connectionStatus` / `bookshelfRootPath`。
- **书架页与子组件联动**
  - BookshelfPage 移除 MOCK_BOOKS，改用 `useBookshelf()`；支持三种 UI 状态：未连接（引导挂载）、加载中（Skeleton）、已加载（BookGrid）；空书架时展示 Empty state（引导添加）。
  - BookGrid 接收 `onBookClick(bookId)`，传递给 BookCard；点击书：`selectBook(bookId)` + `navigate(\`/reader/${bookId}\`)`。
  - TopBar：Settings → `navigate('/settings')`，Import → `mountBookshelf()`，GitHub → 外链。
  - LibrarianBar：本地 state 管理输入，Enter/发送按钮清空输入；暂不接 Agent，仅 UI 骨架。
- **设置页必需能力**
  - 确保设置页具备：LLM Provider 选择及 baseUrl/model 默认值、API Key（password + safeStorage）、Base URL / Model 输入、Temperature / MaxTokens 滑块、书架路径展示与「更换目录」、测试连接按钮（调用 llm:chat 简单消息）、返回导航。Store 已有 `llmConfig` / `bookshelfRootPath` 时与之对齐并持久化。
- **路由与联动**
  - 确保 `/settings` 路由存在并指向设置页；TopBar Settings 绑定 `navigate('/settings')`。

## Capabilities

### New Capabilities

- **bookshelf-hook**：定义 `useBookshelf` 的契约（返回值、mount/unmount/refresh 行为、与 Store/MCP 的协作），以及 Book 从 BookFile 的转换规则（title 取自文件名、author 默认「未知作者」）。

### Modified Capabilities

- **preload-bridge**：在 `ElectronAPI.mcp` 上新增 `connect(path)`、`disconnect()`、`getStatus()` 的暴露与类型；主进程新增对应 IPC handlers 并委托 McpManager，错误通过 try-catch 返回。
- **bookshelf-ui**：BookshelfPage 使用 useBookshelf、三种状态与空状态；BookGrid/BookCard 支持 onBookClick 并触发 selectBook + 路由跳转；TopBar 与 LibrarianBar 的交互与回调要求（Settings/Import/GitHub，输入与发送骨架）。
- **settings-page**：设置页必需行为（LLM 配置区、书架路径、测试连接、返回）；与 Store 的 llmConfig/bookshelfRootPath 及 safeStorage 的集成要求。

## Impact

- **electron/main/ipc-handlers.ts**：新增 3 个 MCP 相关 handler；现有 MCP handler 增加统一错误处理。
- **electron/preload/index.ts**：mcp 对象新增 3 个方法。
- **src/shared/types/electron.d.ts**：`ElectronAPI.mcp` 扩展 3 个方法签名。
- **src/features/bookshelf/hooks/useBookshelf.ts**：新建；依赖 `app.selectDirectory`、`mcp.connect`/`disconnect`/`getStatus`、`mcp.listFiles` 与 Store。
- **src/features/bookshelf/**：BookshelfPage、BookGrid、TopBar、LibrarianBar 行为与 props 变更。
- **src/features/settings/SettingsPage.tsx**：若已存在则按上述必需能力补全；依赖 Store、safeStorage、llm:chat。
- **src/app/router.tsx**：确保 `/settings` 注册。
- **Store**：已具备 llmConfig、bookshelfRootPath、connectionStatus、books、setBooks、setConnectionStatus 等，本变更仅确保 useBookshelf 与设置页正确读写与持久化。
