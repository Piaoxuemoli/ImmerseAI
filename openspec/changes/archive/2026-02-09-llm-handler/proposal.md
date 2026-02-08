## Why

主进程中 `llm:chat` IPC handler 当前是 mock 实现（逐字符拆分固定字符串），无法调用任何真实 LLM API。`app:get-safe-storage` / `app:set-safe-storage` 也是空壳。要让 Actor Agent 的沉浸式对话和 Librarian Agent 的智能书架管理可用，需要在主进程实现完整的 LLM API 调用层和 API Key 安全存储。

## What Changes

- **新增 `electron/main/llm-handler.ts`**：使用 `openai` SDK 封装 LLM API 调用，支持 DeepSeek / Kimi / Moonshot / OpenAI / 自定义端点；流式输出通过 `event.sender.send('llm:chat-chunk', chunk)` 逐 chunk 传递到渲染进程。
- **新增 `electron/main/safe-storage.ts`**：使用 Electron `safeStorage` API 加密存储 / 读取 API Key，持久化到本地 JSON 文件（加密后的 Buffer），永不将明文 Key 暴露给渲染进程。
- **修改 `electron/main/ipc-handlers.ts`**：将 `llm:chat`、`app:get-safe-storage`、`app:set-safe-storage` 三个 handler 从 mock/空壳替换为调用真实实现。
- **修改 `electron/main/index.ts`**：在 `app.whenReady()` 中初始化 safe-storage 模块。

## Capabilities

### New Capabilities
- `llm-handler`: LLM API 调用处理器 — OpenAI-compatible 流式调用、provider 路由（baseUrl 映射）、错误处理（网络超时/429 限流/401 Key 无效）、temperature/maxTokens/model 配置
- `safe-storage`: API Key 安全存储 — Electron safeStorage 加密/解密、本地持久化、IPC handler 实现

### Modified Capabilities
- `preload-bridge`: `llm:chat` handler 从 mock 替换为真实调用，`app:get/set-safe-storage` 从空壳替换为真实实现；IPC 协议不变，仅实现变更

## Impact

- **代码**：新增 2 个文件 (`llm-handler.ts`, `safe-storage.ts`)，修改 2 个文件 (`ipc-handlers.ts`, `index.ts`)
- **依赖**：`openai` SDK（已在 package.json 中声明）
- **安全**：API Key 仅在主进程内存中以明文存在，磁盘上始终加密；渲染进程通过 safeStorage IPC 仅能触发存/取操作，无法直接读取 Key
- **IPC 协议**：`llm:chat` channel 行为从 mock 变为真实流式，`[DONE]` 终止协议保持不变；新增可能的 `llm:chat-error` 事件用于错误传递
