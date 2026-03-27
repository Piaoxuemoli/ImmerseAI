## ADDED Requirements

### Requirement: useBookshelf Hook 契约
系统 SHALL 在 `src/features/bookshelf/hooks/useBookshelf.ts` 提供 `useBookshelf()` hook，封装书架挂载、卸载、刷新及与 Store/MCP 的协作。

#### Scenario: Hook 返回值
- **WHEN** 组件调用 `useBookshelf()`
- **THEN** 返回对象 SHALL 包含：
  - `books: Book[]` — 从 Zustand store 读取
  - `connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'` — 从 store 读取
  - `isLoading: boolean` — 书籍列表加载中（mount 或 refresh 进行中）
  - `error: string | null` — 最近一次错误信息
  - `mountBookshelf: () => Promise<void>` — 挂载书架完整流程
  - `unmountBookshelf: () => Promise<void>` — 卸载书架
  - `refreshBooks: () => Promise<void>` — 刷新书籍列表（复用已有连接）

#### Scenario: mountBookshelf 流程 - 用户选择目录
- **WHEN** 调用 `mountBookshelf()`
- **THEN** 系统 SHALL 调用 `window.electronAPI.app.selectDirectory()` 弹出目录选择
- **AND** 用户取消选择时直接返回，不修改 Store 状态

#### Scenario: mountBookshelf 流程 - 连接与拉取
- **WHEN** 用户选择目录后继续执行
- **THEN** 系统 SHALL 设置 store `connectionStatus = 'connecting'`
- **AND** 调用 `window.electronAPI.mcp.connect(selectedPath)` 连接 MCP
- **AND** 调用 `window.electronAPI.mcp.listFiles(selectedPath)` 获取文件列表
- **AND** 将返回的 BookFile[] 过滤出 .md 与 .txt（path 以 .md 或 .txt 结尾），转换为 Book[]（见「Book 从 BookFile 转换规则」）
- **AND** 调用 store `setBooks(books)`、`setBookshelfRootPath(selectedPath)`、`setConnectionStatus('connected')`
- **AND** 清除 error

#### Scenario: mountBookshelf 错误处理
- **WHEN** connect 或 listFiles 抛出错误
- **THEN** 系统 SHALL 设置 `connectionStatus = 'error'`
- **AND** 将错误信息写入 hook 的 `error` 状态（或等价方式供 UI 展示）
- **AND** 不修改 store 的 books（保持上一次成功列表或空）

#### Scenario: refreshBooks 行为
- **WHEN** 调用 `refreshBooks()` 且当前 `connectionStatus === 'connected'` 且 `bookshelfRootPath` 非空
- **THEN** 系统 SHALL 设置 `isLoading = true`
- **AND** 调用 `window.electronAPI.mcp.listFiles(bookshelfRootPath)` 获取最新列表
- **AND** 按相同规则过滤 .md/.txt 并转换为 Book[]，调用 `setBooks(books)`
- **AND** 完成后设置 `isLoading = false`

#### Scenario: unmountBookshelf 行为
- **WHEN** 调用 `unmountBookshelf()`
- **THEN** 系统 SHALL 调用 `window.electronAPI.mcp.disconnect()`
- **AND** 调用 store `setBooks([])`、`setBookshelfRootPath('')`（或等价）、`setConnectionStatus('disconnected')`

#### Scenario: 异步 try-catch
- **WHEN** 执行 mountBookshelf、refreshBooks、unmountBookshelf 中任意异步步骤
- **THEN** 所有步骤 SHALL 置于 try-catch 中，错误被捕获并用于设置 error 状态或 connectionStatus='error'

### Requirement: Book 从 BookFile 转换规则
系统 SHALL 在 useBookshelf 中将 listFiles 返回的 BookFile 转为 `Book` 类型时遵循下列规则。

#### Scenario: 过滤与字段映射
- **WHEN** 转换 BookFile 为 Book
- **THEN** 仅处理 `type === 'md'` 或 `type === 'txt'` 或 path 以 `.md` 或 `.txt` 结尾的条目（不再处理 .epub）
- **AND** 每个 Book 的 `id` SHALL 为 `crypto.randomUUID()` 生成的新 UUID
- **AND** `title` SHALL 为文件名去掉扩展名（如 `三体.md` → `三体`，`笔记.txt` → `笔记`）
- **AND** `author` SHALL 为默认值 `'未知作者'`
- **AND** `path` SHALL 为 BookFile.path
- **AND** `isIndexed` SHALL 为 `false`

#### Scenario: 无 md/txt 时
- **WHEN** 过滤后无 .md/.txt 文件
- **THEN** 系统 SHALL 得到空数组并写入 store setBooks([])
- **AND** 仍设置 connectionStatus='connected' 与 bookshelfRootPath，以便 UI 展示「空书架」状态
