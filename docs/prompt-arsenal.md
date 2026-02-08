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

## 测试 Prompt 集

> 以下 Prompt 用于验证各模块功能是否正常工作。
> 在对应 Change 实现完成后使用。

### Test: IPC 通信验证
```
在 DevTools Console 中执行以下测试：
1. await window.api.selectDirectory() — 应弹出目录选择对话框
2. await window.api.setSafeStorage('test-key', 'hello') — 应返回 true
3. await window.api.getSafeStorage('test-key') — 应返回 'hello'
验证 IPC 通道工作正常。
```

### Test: MCP 连接验证
```
测试 MCP 文件系统连接：
1. 在书架页点击"挂载书架"，选择一个包含 .epub 文件的目录
2. 验证 BookGrid 中出现对应的书籍卡片
3. 检查 McpManager 连接状态为 'connected'
4. 在 DevTools 中通过 IPC 调用 mcp:listFiles 验证文件列表
```

### Test: RAG Ingest 验证
```
测试 RAG 索引流程：
1. 点击一本未索引的书籍
2. 观察 indexingProgress 从 0 → 100 的进度变化
3. 验证 IndexedDB 中存在 key="book_{id}" 的数据
4. 关闭并重启应用，确认相同书籍无需重新索引（秒级加载）
5. 在 DevTools 中检查 Worker 消息：ingest:progress 和 ingest:complete
```

### Test: RAG Search 验证
```
测试语义检索功能：
1. 确保一本书已完成索引
2. 通过 useRagWorker hook 发送 search 请求
3. 查询："主角的性格特征" — 应返回相关文本片段
4. 验证返回结果包含 text, cfi, chapter, score 字段
5. score 应在 0-1 范围内，且按降序排列
6. 测试未索引书籍的查询 — 应返回友好错误
```

### Test: LLM 流式输出验证
```
测试 LLM API 流式通信：
1. 在设置页配置 API Key（推荐 DeepSeek）
2. 通过 IPC 发送 llm:chat 请求，messages: [{ role: 'user', content: '你好' }]
3. 验证 ReadableStream 能逐 chunk 接收响应
4. 检查完整响应内容有意义
5. 测试错误场景：无效 API Key — 应收到 'auth_error' 类型错误
6. 测试错误场景：空 messages — 应收到参数校验错误
```

### Test: 对话界面验证
```
测试 Chat UI 功能：
1. 进入阅读页，切换到对话模式
2. 输入消息，验证 MessageBubble 正确渲染（用户右对齐、AI 左对齐）
3. 验证 AI 回复有流式打字机效果
4. AI 头像显示角色名首字
5. 多条消息后 ScrollArea 自动滚动到底部
6. 切换回阅读模式再返回，聊天记录保持
```

### Test: 角色生成验证
```
测试 Persona 自动生成：
1. 确保一本书已完成 RAG 索引
2. 打开 PersonaConfigDialog，输入角色名（如"章北海"）
3. 点击"✨ 一键生成人设"
4. 验证生成结果包含：性格特征、说话风格、代表台词、背景故事
5. 验证 systemPrompt 字段已自动组装
6. 修改某个字段后保存，确认 Zustand Store 正确更新
7. 创建对话，验证 AI 以角色身份回复
```

### Test: EPUB 阅读器验证
```
测试 EPUB 渲染功能：
1. 从书架点击一本 EPUB 书籍
2. ReaderPage 应正确加载并渲染 EPUB 内容
3. 翻页功能正常
4. 关闭后重新打开，阅读进度恢复到上次位置（CFI）
5. 模式切换按钮在阅读模式和对话模式间平滑过渡
6. goToCfi() 调用能正确跳转到指定位置
```

### Test: 引用跳转验证
```
测试 Citation 跳转功能：
1. 在对话模式中发送一个与书籍内容相关的问题
2. AI 回复中包含 citations 数组
3. 点击 CitationBadge 应：
   a. 平滑切换到阅读模式
   b. 自动跳转到引用位置（CFI）
   c. 高亮对应文本
4. 返回对话模式，聊天上下文完整保留
```

### Test: 设置页验证
```
测试设置功能：
1. 导航到 /settings 页面
2. 选择 LLM Provider (DeepSeek)
3. 输入 API Key — 验证加密存储（safeStorage）
4. 点击"测试连接" — 应显示连接成功/失败
5. 调整 Temperature 滑块 — 值应实时更新
6. 返回书架页，发起对话 — 应使用新配置的 LLM
7. 重启应用 — 所有配置持久化保留
```

### Test: 端到端完整流程
```
测试完整用户流程：
1. 首次启动 → 配置 API Key → 挂载书架目录
2. 书架展示 EPUB 书籍 → 点击进入阅读页
3. 首次打开 → 自动触发 RAG 索引 → 进度条展示
4. 索引完成 → 创建角色（一键生成人设）
5. 切换到对话模式 → 以角色身份对话
6. AI 回复包含引用 → 点击引用跳转到原文
7. 对话中说"帮我记个笔记" → Agent 生成 Markdown 写入本地
8. 返回书架页 → 通过 LibrarianBar 整理文件
9. 所有操作流畅，无 UI 卡顿
```