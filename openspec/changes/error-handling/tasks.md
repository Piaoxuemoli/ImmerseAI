## 1. Toast 组件与挂载

- [x] 1.1 引入 shadcn/ui Toast 方案（如 Sonner），在 `src/shared/components/ui/` 增加 toast 组件及导出
- [x] 1.2 在应用根布局（如 `App.tsx` 或 `main.tsx` 渲染的根）挂载 `<Toaster />`，确保全局可调用 `toast.error(message)` 等 API

## 2. Error Boundary

- [x] 2.1 创建 `src/shared/components/ErrorBoundary.tsx`（class 组件），实现 `componentDidCatch` 与 `getDerivedStateFromError`，将 error 存入 state
- [x] 2.2 降级 UI：展示简短错误说明与「重新加载」按钮（调用 `window.location.reload()`），并 `console.error` 记录错误
- [x] 2.3 在根组件最外层包裹 `<ErrorBoundary>`，使所有路由与业务组件处于其子树内

## 3. LLM 错误分类

- [x] 3.1 在 `electron/main/llm-handler.ts` 的 catch 中根据异常 status/code/message 映射为 `network_error`、`rate_limited`、`invalid_key`、`server_error`、`unknown`
- [x] 3.2 为每种 code 生成简短中文 message，通过 `event.sender.send('llm:chat-error', { code, message })` 发送
- [x] 3.3 渲染进程在消费 `llm:chat-error` 时根据 code 展示 Toast（调用 `toast.error(message)`）

## 4. Worker 崩溃检测与重启

- [x] 4.1 在 `useRagWorker`（或持有 Worker 的模块）中监听 Worker 的 `error` 与 `exit`（或等效）事件，将实例视为不可用
- [x] 4.2 维护「当前会话内重启次数」状态，崩溃时若次数 < 3 则 `new Worker(...)` 重新创建并初始化，次数 +1
- [x] 4.3 当次数达到 3 时不再重启，触发 Toast「RAG 服务暂时不可用，请刷新页面重试」
- [x] 4.4 页面刷新后重启次数重置（依赖组件卸载/重新挂载或单次会话 state）

## 5. MCP 连接断开提示

- [x] 5.1 确认 useBookshelf 在 MCP 调用失败时已将 `connectionStatus` 设为 `'error'` 并 setError（已有则仅验证）
- [x] 5.2 在书架页或全局布局中当 `connectionStatus === 'error'` 时触发一次 Toast「书架连接已断开，请重新选择目录」（可节流避免重复弹）
- [x] 5.3 不实现自动重连，仅提示用户通过现有入口重连

## 6. 异步 try-catch 覆盖

- [x] 6.1 审查 IPC handlers（`ipc-handlers.ts`），确保所有 MCP/LLM 相关 handler 最外层有 try-catch，错误通过 reject 或 send 返回
- [x] 6.2 审查 useBookshelf、useLibrarian 的 async 路径已有 try-catch（已有则标记完成）
- [x] 6.3 审查 useRagWorker 的 postMessage/onmessage 及 Worker 初始化路径，补全 try-catch，错误时设置本地状态或 Toast
- [x] 6.4 审查其他调用 `window.electronAPI` 或 Worker 的 async 入口（如设置页测试连接、Librarian executeCommand），确保 try-catch 覆盖

## 7. 验证与收尾

- [x] 7.1 运行 `npx tsc --noEmit` 确保无新增类型错误
- [x] 7.2 手动验证：触发一次渲染错误，确认 Error Boundary 展示降级 UI 且可重新加载
- [x] 7.3 手动验证：LLM 无效 Key 或断网时，确认收到 `llm:chat-error` 且 Toast 展示对应中文文案
- [x] 7.4 手动验证：MCP 断开后操作书架，确认出现「请重新选择目录」类提示
