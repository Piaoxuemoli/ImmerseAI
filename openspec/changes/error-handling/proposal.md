## Why

应用当前缺乏统一的错误边界与用户可感知的错误反馈：React 渲染异常会白屏、RAG Worker 崩溃后无自动恢复、MCP 断开或 LLM 调用失败时用户得不到清晰提示。实现全局错误处理和边界保护，能提升稳定性和可观测性，并在出错时给出友好、可操作的反馈。

## What Changes

- 使用 **React Error Boundary** 包裹根应用，捕获子树渲染错误并展示降级 UI，避免整页白屏。
- **Worker 崩溃检测与自动重启**：检测 RAG Worker 异常退出，自动重启最多 3 次，并记录/提示失败原因。
- **MCP 连接断开检测与重连提示**：在连接断开时检测并提示用户（Toast 或内联），引导重新选择目录或重连。
- **LLM API 错误分类**：将 LLM 调用失败区分为网络断开、API 限流、Key 无效等类型，并返回可读、可展示的错误信息。
- **友好错误 UI**：通过 **shadcn/ui Toast** 及必要处的内联错误状态展示错误，避免仅控制台报错。
- **异步操作 try-catch 覆盖**：对关键 async 路径（IPC 调用、LLM、MCP、Worker 通信）统一 try-catch，错误统一上报或展示，不未捕获抛出。

## Capabilities

### New Capabilities

- `error-boundary`: 根级 React Error Boundary 组件与降级 UI，捕获渲染错误并可选上报。
- `worker-recovery`: RAG Worker 崩溃检测、自动重启策略（如最多 3 次）及失败后的用户提示。
- `mcp-connection-ux`: MCP 连接断开检测、状态暴露及重连提示（Toast/内联），与现有 connectionStatus 协同。
- `llm-error-classification`: LLM 调用错误分类（网络/限流/Key 无效等）与结构化错误信息，供 UI 与日志使用。
- `toast-errors`: 基于 shadcn/ui 的 Toast 组件展示全局/关键错误通知，与内联错误状态配合。

### Modified Capabilities

- `llm-handler`: 增加错误分类与用户可读错误信息的产出要求，与 `llm-error-classification` 对齐。
- `rag-worker`: 增加 Worker 崩溃检测与自动重启（最多 3 次）及失败上报/提示的要求。

## Impact

- **根应用**：`src/app` 或入口组件需被 Error Boundary 包裹；可能新增 `src/shared/components/ErrorBoundary.tsx` 或等价。
- **RAG Worker**：主进程或渲染进程与 Worker 的通信层需检测崩溃并实现重启与重试计数；可能涉及 `rag-worker` 相关封装。
- **MCP / 书架**：需在连接状态变化或调用失败时触发断开检测与提示，可能涉及 `useBookshelf`、IPC 或 Store 的 connectionStatus。
- **LLM 调用链**：`electron/main/llm-handler.ts` 及前端调用处需解析错误类型并映射为分类结果与文案。
- **UI 与依赖**：引入 shadcn/ui Toast（如 Sonner 或项目现有 Toast 方案），并在一致位置消费错误状态以展示 Toast 或内联错误。
- **代码规范**：关键 async 路径需增加或补全 try-catch，错误统一处理或展示，不改变现有 API 签名（仅内部实现与错误处理增强）。
