# Error Handling — Design

## Context

- **现状**：React 渲染错误会导致整页白屏；RAG Worker 若崩溃，前端仅表现为无响应或超时；MCP 连接断开或 LLM 调用失败时，错误多停留在控制台或局部 state，缺少统一、可操作的提示。已有部分 try-catch（如 IPC handlers、useBookshelf），但未形成分类与统一展示。
- **约束**：宪法 P-2/P-3 要求不阻塞 UI、文件操作经 MCP；需与现有 Store（connectionStatus）、IPC、llm-handler、rag-worker 集成，不破坏现有 API 契约。
- **相关模块**：根应用入口、`electron/main/llm-handler.ts`、RAG Worker 与 `useRagWorker`、MCP/useBookshelf、shadcn/ui 组件库。

## Goals / Non-Goals

**Goals:**

- 根应用被 Error Boundary 包裹，渲染错误时展示降级 UI，避免白屏。
- RAG Worker 崩溃可被检测，自动重启最多 3 次，失败后通过 Toast 或内联提示用户。
- MCP 连接断开可被检测并提示用户，引导重连（如重新选择目录）。
- LLM 调用错误被分类（网络断开、API 限流、Key 无效等），并产出可读、可展示的文案供 Toast/内联使用。
- 使用 shadcn/ui Toast 展示关键错误；必要时保留内联错误状态（如 useBookshelf.error）。
- 关键 async 路径（IPC、LLM、MCP、Worker）均有 try-catch，错误统一处理或展示。

**Non-Goals:**

- 不实现完整日志上报或第三方错误监控（仅预留或控制台）；不改变现有业务 API 签名；不做自动重试 LLM 请求（仅分类与提示）。

## Decisions

### D1: Error Boundary 放置与降级 UI

- **选择**：在 React 根（如 `src/app/App.tsx` 或 `main.tsx` 渲染的根组件）外包裹一层 class 组件 Error Boundary；降级 UI 展示简短错误说明与「重新加载」按钮（调用 `window.location.reload()` 或等价）。
- **理由**：仅 class 组件可实现 `componentDidCatch`；根级一层即可捕获子树渲染错误，避免白屏。不在此变更内实现错误上报服务，仅控制台 `console.error` 或预留回调。
- **备选**：多层级 Boundary 按路由包裹 — 增加复杂度，首版根级即可。

### D2: Worker 崩溃检测与重启策略

- **选择**：在持有 Worker 的层（如 `useRagWorker` 或封装 Worker 的 hook/模块）检测 Worker 的 `error` 与 `exit` 事件（或 `terminate` 后的不可用状态）；维护「当前会话内重启次数」计数器，小于 3 次时自动重新 `new Worker(...)` 并重新初始化，超过 3 次则不再重启，并触发 Toast「RAG 服务暂时不可用，请刷新页面重试」。
- **理由**：Worker 无标准「健康检查」API，通过事件与生命周期判定崩溃；限制 3 次避免无限重启；用户可刷新页面重置计数器。
- **备选**：主进程轮询 Worker — 在 Electron 中 Worker 常运行在渲染进程，主进程无直接句柄，故以渲染进程内检测为准。

### D3: MCP 连接断开检测与提示

- **选择**：复用 Store 的 `connectionStatus`（已有 `'error'` / `'disconnected'`）；在关键 MCP 调用失败时（如 listFiles 在已连接状态下 reject），由调用方（如 useBookshelf）将 status 设为 `'error'` 并 setError；在 Bookshelf 或全局布局中，当 `connectionStatus === 'error'` 时触发一次 Toast「书架连接已断开，请重新选择目录」；不在此变更内实现自动重连，仅提示用户操作。
- **理由**：现有 useBookshelf 已在 connect/listFiles 失败时 setConnectionStatus('error')；只需在 UI 层统一用 Toast 或内联提示，避免每处重复写文案。
- **备选**：主进程轮询 MCP 连接 — 增加复杂度，且 McpManager 已有 getStatus，由渲染进程在关键操作失败时推断即可。

### D4: LLM 错误分类与结构化信息

- **选择**：在 `llm-handler.ts` 内对 catch 到的错误进行解析：根据 `error.code`、`error.status`、`message` 关键字（如 `ECONNREFUSED`、`ETIMEDOUT`、`401`、`429`、`invalid_api_key` 等）映射为枚举：`network_error`、`rate_limited`、`invalid_key`、`server_error`、`unknown`；并生成简短用户可读文案（中文）。通过现有 `llm:chat-error` IPC 将 `{ code, message }` 传给渲染进程，渲染进程据此展示 Toast。
- **理由**：分类与文案集中在主进程，前端只消费 code + message，避免重复解析；与现有流式错误通道一致。
- **备选**：前端解析 — 主进程只传原始 Error，前端再分类；不利于主进程日志与测试，故不采用。

### D5: Toast 组件与使用方式

- **选择**：引入 shadcn/ui 的 Toast 方案（如基于 Sonner 的 `components/ui/sonner.tsx` 或项目已有 Toast）；在应用根布局挂载 `<Toaster />`；在 Error Boundary 降级 UI、useBookshelf（连接错误）、useLibrarian/LLM 错误回调、Worker 重启失败等处调用 `toast.error(message)` 或等价 API。
- **理由**：统一入口展示全局错误，避免多处自定义弹窗；shadcn 与现有 UI 风格一致。
- **备选**：仅内联错误 — 不利于跨组件/异步错误，故与 Toast 并存。

### D6: 异步 try-catch 覆盖范围

- **选择**：对以下路径做审查并补全 try-catch，确保错误不未捕获抛出：(1) IPC handlers（已有部分，查漏补缺）；(2) LLM 流式调用（主进程与 preload 的 error 事件）；(3) useBookshelf 的 mountBookshelf / refreshBooks / unmountBookshelf（已有）；(4) useLibrarian 的 executeCommand / confirmDelete（已有）；(5) Worker 消息处理与初始化（useRagWorker 或等价）；(6) 其他调用 `window.electronAPI` 或 Worker 的 async 入口。捕获后统一：记录日志、设置本地/Store 错误状态或触发 Toast，不吞掉错误不处理。
- **理由**：避免未捕获 Promise rejection 导致控制台报错或应用表现异常；不改变函数签名，仅内部包裹与错误处理。
- **备选**：全局 unhandledrejection — 仅作兜底，仍应在调用点显式 try-catch 以便上下文清晰。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Error Boundary 仅捕获渲染阶段错误，不捕获异步或事件回调内错误 | 异步路径继续依赖 try-catch + Toast/状态；可后续增加 unhandledrejection 兜底 |
| Worker 重启后状态丢失（如索引进度） | 重启后视为新会话，必要时由上层重新发起索引；文档说明「最多 3 次」后需用户刷新 |
| LLM 错误分类依赖各 provider 的 error 格式不统一 | 使用常见 code/status 与 message 关键字映射，unknown 兜底并展示原始 message |
| Toast 频率过高打扰用户 | 对同类错误做节流或去重（如 5s 内同 code 只弹一次），后续可配置 |

## Migration Plan

1. **顺序**：先引入 Toast 组件与 Toaster 挂载；再实现 Error Boundary 并包裹根组件；然后主进程 LLM 错误分类与 IPC 错误负载扩展；接着 Worker 崩溃检测与重启逻辑；最后 MCP 断开提示与 try-catch 查漏补缺。
2. **回退**：各能力相对独立；可先关闭 Error Boundary 或 Worker 重启，仅保留 Toast 与 LLM 分类，再逐步启用。
3. **兼容**：不改变现有 Store 形状或 IPC channel 名；仅扩展错误 payload（如 llm:chat-error 的 code）与新增组件/文件。

## Open Questions

- 无。若后续需要错误上报到远程，可在 Error Boundary 与 Toast 调用处预留回调或事件名，由其他变更接入。
