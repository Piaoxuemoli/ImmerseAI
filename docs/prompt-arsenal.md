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
