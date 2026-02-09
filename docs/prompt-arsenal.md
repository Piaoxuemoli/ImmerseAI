# 🔫 Prompt 武器库

每个 Prompt 在执行 /openspec-apply 前使用。
格式：直接粘贴到 Copilot Chat。

---

## Phase 1

### Change: init-scaffold
请基于 electron-vite 创建 ImmerseAI 项目。
参考模板：https://github.com/terrence-ou/electron-react-shadcn
技术栈：Electron 28+ / React 18+ / TypeScript strict / Vite 5+
要求：
1. 主进程入口 electron/main/index.ts
2. preload 脚本 electron/preload/index.ts（contextBridge）
3. React 入口 src/main.tsx
4. 配置 TailwindCSS + postcss + autoprefixer
5. Feature-based 目录结构（见宪法第七章）
6. 在 BrowserWindow 中启用 Cross-Origin headers（为 Transformers.js 准备）
参考 spike: docs/spikes/ 目录中的代码片段

### Change: init-ipc-bridge
在 electron/preload/index.ts 中通过 contextBridge 暴露以下 IPC channel：
- mcp:listFiles(path: string) → Promise<BookFile[]>
- mcp:readFile(path: string) → Promise<ArrayBuffer>
- mcp:writeFile(path: string, content: string) → Promise<void>
- mcp:moveFile(source: string, dest: string) → Promise<void>
- llm:chat(messages: Message[], config: LlmConfig) → 返回 ReadableStream
- app:selectDirectory() → Promise<string | null>
- app:getSafeStorage(key: string) → Promise<string>
- app:setSafeStorage(key: string, value: string) → Promise<void>

在 electron/main/ipc-handlers.ts 中注册对应的 ipcMain.handle。
类型定义参考 src/shared/types/index.ts。
安全要求：nodeIntegration=false, contextIsolation=true。

### Change: init-store
创建 src/shared/store/index.ts，使用 Zustand 实现全局状态管理。
Store 结构严格参考宪法第五章 5.2 节的 ImmerseStore 接口。
要求：
1. 使用 zustand/middleware 的 persist 中间件
2. books / personas / currentSession 持久化到 localStorage
3. indexingProgress / isGenerating 不持久化（运行时状态）
4. 所有 action 都有明确的 TypeScript 类型

---

## Phase 2

### Change: mcp-manager
在 electron/main/mcp-manager.ts 创建 McpManager 单例类。
严格参考 docs/spikes/spike-mcp-client.ts 的 API 用法。
要求：
1. 使用 @modelcontextprotocol/sdk 的 Client 和 StdioClientTransport
2. connectLocal(path) 方法：spawn server-filesystem 子进程
3. 连接失败自动重试（最多 3 次，间隔 2 秒）
4. disconnect() 正确清理子进程
5. 暴露 listFiles / readFile / writeFile / moveFile 方法
6. 所有方法都有完整的错误处理和 TypeScript 类型

### Change: bookshelf-ui
创建书架页面 src/features/bookshelf/BookshelfPage.tsx。
UI 参考图片：docs/design-reference/bookshelf-loaded.png
要求：
1. TopBar: "ImmerseAI" logo + Settings/Import/GitHub 图标按钮
2. BookGrid: 响应式网格，BookCard 2:3 宽高比
3. BookCard: 封面 + 标题 + 作者，hover 缩放效果
4. 底部 LibrarianBar: 固定定位，聊天输入框 + 发送按钮
5. 使用 shadcn/ui 的 Button, ScrollArea, Card
6. 使用 lucide-react 图标
7. 严格遵循 Notion 极简风格（slate 色板）
8. mock 6 本书的数据

---

## Phase 3

### Change: rag-worker-setup
创建 src/workers/rag.worker.ts 和 src/workers/rag-types.ts。
参考 docs/spikes/spike-transformers-worker.ts 的代码结构。
要求：
1. Worker 消息协议：WorkerMessage 和 WorkerResponse 类型
2. 支持的消息类型：ingest / search / status / ping
3. 模型加载单例模式
4. 在 src/shared/hooks/ 创建 useRagWorker.ts hook 封装 Worker 通信
5. Vite 配置中排除 @xenova/transformers 的预打包

### Change: rag-indexing
在 rag.worker.ts 中实现 ingest 函数。
参考 docs/spikes/spike-orama-vector.ts 的 Orama API。
要求：
1. 使用 LangChain RecursiveCharacterTextSplitter(500, 50)
2. 批量向量化（batch size 32 以避免内存溢出）
3. 存入 Orama（schema: text, embedding[384], cfi, chapter）
4. 每 10% 进度通过 postMessage 上报
5. 完成后使用 @orama/plugin-data-persistence 持久化到 IndexedDB

### Change: rag-search
在 rag.worker.ts 中实现 search 函数（当前为 "not implemented" 占位）。
参考 docs/spikes/spike-orama-vector.ts 的向量检索 API。
要求：
1. 接收 query 字符串 + bookId + topK(默认5)
2. 使用 Transformers.js 将 query 向量化（复用已加载的单例模型）
3. 调用 Orama 的 search 接口进行向量相似度检索
4. 返回 SearchResult[]（text, cfi, chapter, score）
5. 如果该书籍未索引，返回友好错误消息
6. 支持从 IndexedDB 恢复索引后直接检索

---

## Phase 4

### Change: llm-handler
在 electron/main/llm-handler.ts 创建 LLM API 处理器。
参考 docs/spikes/spike-deepseek-stream.ts 的流式调用。
要求：
1. 使用 openai SDK，支持 DeepSeek / Kimi / Moonshot / OpenAI
2. API Key 从 safeStorage 读取，不暴露给渲染进程
3. 流式输出：通过 IPC 逐 chunk 传递到渲染进程
4. 支持配置 temperature / maxTokens / model
5. 完整的错误处理（网络超时、API 限流、Key 无效）

### Change: chat-ui
创建 src/features/chat/components/ChatInterface.tsx。
UI 参考图片：docs/design-reference/chat-mode.png
要求：
1. MessageBubble: 用户右对齐 slate-100，AI 左对齐白色带边框
2. AI 头像：角色名首字在 slate-800 圆圈中
3. 流式打字机效果：逐字渲染 AI 回复
4. CitationBadge: 可点击的引用标签（📎图标 + 章节信息）
5. ChatInput: 底部固定，placeholder 带角色名
6. 使用 framer-motion 做消息出现动画

### Change: epub-reader
创建 src/features/reader/components/EpubViewer.tsx 和 ReaderHeader.tsx、ModeToggle.tsx。
参考 docs/spikes/spike-react-reader.tsx 的 react-reader 用法。
要求：
1. 使用 react-reader (基于 epub.js) 渲染 EPUB 文件
2. 通过 IPC 调用 MCP readFile 获取 EPUB ArrayBuffer
3. ReaderHeader: 返回按钮 + 书名 + 角色选择按钮 + 模式切换按钮
4. ModeToggle: 📖阅读 ⇄ 💬对话 模式切换（framer-motion 过渡动画）
5. 记住阅读进度（CFI 存入 Zustand Store + localStorage）
6. 支持 goToCfi(cfi) 方法（供引用跳转调用）
7. 更新 ReaderPage.tsx 整合所有子组件
8. 阅读模式和对话模式使用 AnimatePresence 切换

### Change: persona-ui
创建 src/features/persona/components/PersonaConfigDialog.tsx。
UI 参考宪法第六章 6.4 节的角色配置弹窗设计。
要求：
1. 使用 shadcn/ui 的 Dialog 组件
2. 角色名称输入框（必填）
3. 角色描述输入框（可选，简述）
4. "✨ 一键生成人设"按钮：调用 PersonaGenerator 服务
5. 生成后展示：性格特征、说话风格、代表台词、背景故事
6. 所有字段可手动编辑
7. "保存角色"按钮：验证必填字段，写入 Zustand Store
8. 角色数据结构严格遵循宪法第五章 Persona 接口

### Change: persona-generator
创建 src/features/chat/services/persona-generator.ts。
参考宪法第四章 4.3.3 节的自动化人设生成流程。
要求：
1. generatePersona(bookId, characterName) 主函数
2. 并发执行三维度 RAG 检索（性格、台词、事件）
3. 合并去重检索结果
4. 组装 LLM Prompt（要求返回符合 Persona 接口的 JSON）
5. 调用 LLM API（通过 IPC → llm:chat）
6. 解析 JSON 响应，生成完整 systemPrompt
7. 错误处理：RAG 未索引、LLM 返回格式错误、网络失败

---

## Phase 5

### Change: settings-page
创建设置页面 src/features/settings/SettingsPage.tsx。
要求：
1. LLM 配置区：Provider 下拉选择 + API Key 输入 + Base URL + Model 名称
2. API Key 通过 IPC 调用 safeStorage 加密存储
3. Temperature / MaxTokens 滑块配置
4. 书架路径显示 + "更换目录"按钮
5. "测试连接"按钮：发送简单请求验证 API Key 有效性
6. 路由注册：/settings 路径
7. 使用 shadcn/ui 的 Input, Select, Slider, Label, Separator
8. 所有配置变更即时写入 Zustand Store（persist 到 localStorage）

### Change: citation-jump
实现对话引用跳转到阅读器原文的功能。
参考宪法第八章 8.6 节 Phase 5 任务 5.1。
要求：
1. ChatInterface 中的 MessageBubble 渲染 citations 数组
2. 每个 citation 渲染 CitationBadge（📎图标 + 章节名 + 相似度）
3. 点击 CitationBadge：
   - 切换 readerMode 为 'read'
   - 调用 EpubViewer.goToCfi(citation.cfi)
   - 高亮对应文本片段
4. framer-motion 实现 chat → read 模式平滑过渡
5. 返回对话模式时保持之前的聊天上下文

### Change: note-taking
实现 Agent 笔记功能：用户在对话中说"记笔记"时自动生成 Markdown 并写入本地。
要求：
1. 在对话流程中检测"记笔记"/"做笔记"等意图
2. LLM 生成结构化 Markdown 笔记内容
3. 通过 IPC → MCP write_file 写入用户书架目录下的 notes/ 文件夹
4. 文件名格式：{书名}-{日期}-{主题}.md
5. 写入成功后在对话中展示确认消息和文件路径
6. 支持追加模式（同一笔记文件追加内容）

### Change: librarian-agent
增强 LibrarianBar 的 Agent 能力：解析自然语言意图并调用 MCP 工具。
参考宪法第四章 4.1.3 节的 MCP 工具链映射。
要求：
1. 意图识别：通过 LLM 判断用户意图（列出文件/移动文件/创建目录/删除文件）
2. 参数提取：从自然语言中提取路径、文件名等参数
3. 工具调用：通过 IPC → MCP 执行对应操作
4. 结果反馈：操作成功/失败后在 LibrarianBar 中展示结果
5. 危险操作（删除）需要二次确认弹窗
6. 操作历史记录（最近 10 条）

### Change: error-handling
实现全局错误处理和边界保护。
要求：
1. React Error Boundary 组件包裹根应用
2. Worker 崩溃检测和自动重启（最多 3 次）
3. MCP 连接断开检测和重连提示
4. LLM API 错误分类（网络断开、API 限流、Key 无效）
5. 友好的错误 UI（Toast 通知 / 内联错误状态）
6. 使用 shadcn/ui 的 Toast 组件
7. 所有 async 操作的 try-catch 覆盖

### Change: app-packaging
配置 electron-builder 打包和分发。
要求：
1. 配置 electron-builder.yml（Windows .exe + macOS .dmg）
2. 应用图标和元数据
3. ASAR 打包
4. 自动更新配置（可选，未来扩展）
5. 构建脚本：npm run build && npm run pack
6. 确保 MCP server-filesystem 二进制文件正确打包
7. 测试打包产物可正常运行

---

## Phase 2 补全：IPC→MCP 真实桥接 + 书架交互逻辑

> Phase 2 的 McpManager 实现 (536行) 已经完成，但 ipc-handlers.ts 中 mcp:* 全是 mock 数据，
> BookCard 点击无路由跳转，TopBar 按钮 onClick 全空，BookshelfPage 使用硬编码 MOCK_BOOKS。
> 以下 Change 将这些"断裂的管道"全部接通。

### Change: ipc-mcp-bridge
将 electron/main/ipc-handlers.ts 中的 MCP mock handlers 替换为真实 McpManager 调用。

当前状态：
- mcp-manager.ts (536行) 已完整实现 McpManager 单例，包含 connectLocal / listFiles / readFile / writeFile / moveFile
- ipc-handlers.ts 中 mcp:list-files / mcp:read-file / mcp:write-file / mcp:move-file 全部返回硬编码 mock 数据
- preload/index.ts 已暴露 mcp.listFiles / readFile / writeFile / moveFile
- 但 preload 缺少 mcp.connect / mcp.disconnect / mcp.getStatus 方法
- electron.d.ts 缺少对应的连接管理类型

要求：
1. **ipc-handlers.ts**：
   - `import { McpManager } from './mcp-manager'`
   - 新增 `mcp:connect` handler：调用 `McpManager.getInstance().connectLocal(path)`
   - 新增 `mcp:disconnect` handler：调用 `McpManager.getInstance().disconnect()`
   - 新增 `mcp:get-status` handler：调用 `McpManager.getInstance().getStatus()`
   - `mcp:list-files` → 调用 `McpManager.getInstance().listFiles(path)`
   - `mcp:read-file` → 调用 `McpManager.getInstance().readFile(path)`，返回 ArrayBuffer
   - `mcp:write-file` → 调用 `McpManager.getInstance().writeFile(path, content)`
   - `mcp:move-file` → 调用 `McpManager.getInstance().moveFile(source, destination)`
   - 每个 handler 都有 try-catch，捕获 McpConnectionError 并返回有意义的错误信息
2. **preload/index.ts**：
   - 新增 `mcp.connect(path: string): Promise<void>`
   - 新增 `mcp.disconnect(): Promise<void>`
   - 新增 `mcp.getStatus(): Promise<{ status: string; connectedPath: string | null }>`
3. **src/shared/types/electron.d.ts**：
   - ElectronAPI.mcp 新增 connect / disconnect / getStatus 方法签名
4. 所有改动必须通过 TypeScript 编译检查
5. 删除所有 TODO 注释和 mock 数据

### Change: bookshelf-hook
创建 src/features/bookshelf/hooks/useBookshelf.ts，实现书架的完整业务逻辑。

当前状态：
- src/features/bookshelf/hooks/ 是空文件夹
- BookshelfPage.tsx 使用硬编码的 MOCK_BOOKS 数组
- Zustand store 已有 books / setBooks / connectionStatus / setConnectionStatus
- window.electronAPI.mcp 已暴露 listFiles（将在 ipc-mcp-bridge 中补充 connect/disconnect）

要求：
1. 创建 useBookshelf() hook，返回：
   ```typescript
   {
     books: Book[]                     // 从 Zustand store 读取
     connectionStatus: string          // 'disconnected' | 'connecting' | 'connected' | 'error'
     isLoading: boolean                // 书籍列表加载中
     error: string | null              // 错误信息
     mountBookshelf: () => Promise<void>   // 挂载书架完整流程
     unmountBookshelf: () => Promise<void> // 卸载书架
     refreshBooks: () => Promise<void>     // 刷新书籍列表
   }
   ```
2. `mountBookshelf()` 实现完整流程：
   - 调用 `window.electronAPI.app.selectDirectory()` 弹出目录选择
   - 用户取消则直接返回
   - 设置 `connectionStatus = 'connecting'`
   - 调用 `window.electronAPI.mcp.connect(selectedPath)` 连接 MCP
   - 调用 `window.electronAPI.mcp.listFiles(selectedPath)` 获取文件列表
   - 将 BookFile[] 过滤出 .epub 文件，转换为 Book[] 对象（生成 UUID、提取 title/author）
   - 写入 Zustand store（setBooks / setConnectionStatus='connected'）
   - 错误时设置 connectionStatus='error' 并记录 error 信息
3. `refreshBooks()` 复用已有连接重新获取文件列表
4. Book 对象的 title 从文件名中提取（去掉 .epub 后缀），author 默认 "未知作者"
5. 所有异步操作都有 try-catch

### Change: bookshelf-wiring
将 BookshelfPage 及其子组件从 mock 数据切换到真实业务逻辑。

当前状态：
- BookshelfPage.tsx 顶部硬编码了 MOCK_BOOKS 数组
- BookGrid 接收 books prop 但 BookCard onClick 全空
- TopBar 三个按钮 onClick 全空
- LibrarianBar onKeyDown / onClick 全空
- 无导航逻辑（未使用 react-router-dom 的 useNavigate）

要求：
1. **BookshelfPage.tsx**：
   - 删除 MOCK_BOOKS 硬编码
   - 使用 useBookshelf() hook 获取 books / connectionStatus / mountBookshelf
   - books 来自 hook 而非 mock
   - 处理三种状态：未连接（引导挂载）、加载中（Skeleton）、已加载（BookGrid）
   - 空书架状态展示宪法 6.2 节的 Empty state（"拖入 EPUB 文件" + Add 卡片）
2. **BookGrid.tsx**：
   - 接收 `onBookClick: (bookId: string) => void` 回调 prop
   - 传递给每个 BookCard 的 onClick
3. **BookCard.tsx**：
   - 保持接收 `onClick` prop 不变（已有）
4. **BookshelfPage.tsx 中的导航逻辑**：
   - `import { useNavigate } from 'react-router-dom'`
   - `onBookClick` 回调：`store.selectBook(bookId)` + `navigate(\`/reader/${bookId}\`)`
5. **TopBar.tsx**：
   - 接收 `onSettingsClick` / `onImportClick` 回调 props
   - Settings 按钮：`navigate('/settings')`（设置页创建前可先注册路由并放占位页面）
   - Import/Download 按钮：调用 `mountBookshelf()`
   - GitHub 按钮：可暂时 `window.open('https://github.com/...')`
6. **LibrarianBar.tsx**：
   - 添加 `const [input, setInput] = useState('')` 管理输入值
   - onKeyDown: Enter 键触发发送（Phase 5 librarian-agent 再实现 Agent 逻辑，当前先做 UI 交互基础）
   - onClick: 同上
   - 发送后清空输入框
   - 暂不实现 Agent 调用，仅完成 UI 交互骨架
7. 所有修改通过 TypeScript 编译检查

---

## Phase 4 补全：设置页（API Key 配置入口）

> Phase 4 的 LLM Handler / Chat UI / Persona / Reader 全部实现完成，
> 但缺少设置页面导致用户无法通过 UI 配置 API Key，整条 AI 链路无法在界面上激活。
> 此 Change 原属 Phase 5 的 settings-page，但因为它是 Phase 4 功能可用的前置条件，提前到此处。

### Change: settings-page-essential
创建最小可用的设置页面，确保 LLM API 链路可通过 UI 配置。

当前状态：
- electron/main/safe-storage.ts 已实现加密存储，暴露 getSafeStorageValue / setSafeStorageValue
- ipc-handlers.ts 已注册 app:get-safe-storage / app:set-safe-storage
- preload 已暴露 window.electronAPI.app.getSafeStorage / setSafeStorage
- llm-handler.ts 已实现流式调用，从 safeStorage 读取 Key（key 名为 `llm_api_key`）
- Zustand store 中无 LLM 配置相关 state（需要新增）
- src/features/settings/ 目录不存在
- router.tsx 无 /settings 路由
- shadcn/ui 已有 button, dialog, input, label, scroll-area, textarea, avatar
- 缺少 separator 组件

要求：
1. **Zustand Store 扩展** — 在 src/shared/store/index.ts 中新增：
   ```typescript
   // 新增 state
   llmConfig: {
     provider: 'deepseek' | 'kimi' | 'moonshot' | 'openai' | 'custom'
     baseUrl: string
     model: string
     temperature: number
     maxTokens: number
   }
   bookshelfPath: string | null  // 当前挂载的书架路径
   
   // 新增 actions
   setLlmConfig: (config: Partial<ImmerseStore['llmConfig']>) => void
   setBookshelfPath: (path: string | null) => void
   ```
   - llmConfig 需要 persist 到 localStorage
   - 默认值：provider='deepseek', baseUrl='https://api.deepseek.com', model='deepseek-chat', temperature=0.7, maxTokens=2048
2. **SettingsPage 组件** — 创建 src/features/settings/SettingsPage.tsx：
   - **LLM 配置区**：
     - Provider 选择（原生 select 即可，暂不需要 shadcn Select）：deepseek / kimi / moonshot / openai / custom
     - 切换 Provider 自动更新 baseUrl 和 model 的默认值：
       - deepseek → `https://api.deepseek.com` / `deepseek-chat`
       - kimi → `https://api.moonshot.cn/v1` / `moonshot-v1-8k`
       - moonshot → `https://api.moonshot.cn/v1` / `moonshot-v1-8k`
       - openai → `https://api.openai.com/v1` / `gpt-4o-mini`
       - custom → 用户自填
     - API Key 输入框（type="password"），onChange 时调用 `window.electronAPI.app.setSafeStorage('llm_api_key', value)`
     - 页面初始化时调用 `window.electronAPI.app.getSafeStorage('llm_api_key')` 回填（用 '••••••' 掩码显示已有 Key）
     - Base URL 输入框
     - Model 名称输入框
     - Temperature 滑块 (`<input type="range">` 即可) 0.0 - 1.0，步进 0.1
     - MaxTokens 滑块 256 - 8192
   - **书架配置区**：
     - 当前路径显示（从 store.bookshelfPath 读取，无则显示"未挂载"）
     - "更换目录"按钮：调用 selectDirectory
   - **测试连接按钮**：
     - 点击后通过 IPC 调用 llm:chat 发送一条简单消息 `[{role:'user', content:'ping'}]`
     - 成功显示 "✅ 连接成功"，失败显示 "❌ 连接失败: {错误原因}"
   - **返回按钮**：navigate(-1) 或 navigate('/bookshelf')
   - 风格：Notion 极简，slate 色板，与书架页一致
3. **路由注册** — 在 src/app/router.tsx 中添加 `/settings` → `<SettingsPage />`
4. **TopBar 联动** — 确保 TopBar Settings 按钮已绑定 `navigate('/settings')`（在 bookshelf-wiring 中处理）
5. 所有修改通过 TypeScript 编译检查