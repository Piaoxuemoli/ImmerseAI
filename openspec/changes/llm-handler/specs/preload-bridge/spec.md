## MODIFIED Requirements

### Requirement: LLM API 接口 (MODIFIED)
preload 脚本 SHALL 通过 `contextBridge` 暴露 `window.electronAPI.llm.chat()` 方法，该方法返回 `ReadableStream<string>` 用于接收流式 LLM 响应，**并处理流中错误事件**。

> **变更说明**: 新增 `llm:chat-error` 事件监听，使渲染进程能在 ReadableStream 层面捕获流中错误。

#### Scenario: 正常流式接收（不变）
- **WHEN** 渲染进程调用 `window.electronAPI.llm.chat(messages, config)`
- **THEN** 返回一个 `ReadableStream<string>`
- **AND** 对每个通过 `llm:chat-chunk` IPC event 接收到的 chunk 执行 `controller.enqueue(chunk)`
- **AND** 当收到 `'[DONE]'` 时执行 `controller.close()`

#### Scenario: 流中错误处理（新增）
- **WHEN** 主进程通过 `event.sender.send('llm:chat-error', errorPayload)` 发送错误
- **THEN** preload 脚本中注册的 `ipcRenderer.on('llm:chat-error', ...)` 监听器被触发
- **AND** 监听器调用 `controller.error(new Error(errorPayload.message))` 终止 ReadableStream
- **AND** 渲染进程可通过 ReadableStream 的 `.catch()` 或 `try/catch` 在 reader 层捕获此错误

#### Scenario: 事件监听器清理（增强）
- **WHEN** ReadableStream 完成（`[DONE]`）或出错（`llm:chat-error`）
- **THEN** preload 脚本 SHALL 在 `cancel()` 回调和正常结束路径中移除 `llm:chat-chunk` 和 `llm:chat-error` 两个监听器
- **AND** 避免因监听器泄漏导致的内存问题

### Requirement: 应用工具接口 (MODIFIED)
preload 脚本 SHALL 通过 `contextBridge` 暴露 `window.electronAPI.app` 下的安全存储方法，调用真实的主进程 safe-storage 模块。

> **变更说明**: `getSafeStorage` 和 `setSafeStorage` 从 mock 占位符变为调用真实 IPC handler。

#### Scenario: 获取安全存储值
- **WHEN** 渲染进程调用 `window.electronAPI.app.getSafeStorage(key)`
- **THEN** 通过 `ipcRenderer.invoke('app:get-safe-storage', { key })` 调用主进程
- **AND** 返回 `Promise<string>`（解密后的值或空字符串）

#### Scenario: 设置安全存储值
- **WHEN** 渲染进程调用 `window.electronAPI.app.setSafeStorage(key, value)`
- **THEN** 通过 `ipcRenderer.invoke('app:set-safe-storage', { key, value })` 调用主进程
- **AND** 返回 `Promise<boolean>`（成功为 `true`，失败为 `false`）

### Requirement: IPC 通道白名单 (MODIFIED)
preload 脚本 SHALL 仅暴露预定义的安全 IPC 通道，**新增 `llm:chat-error` 事件通道**。

> **变更说明**: 白名单中新增 `llm:chat-error` on 类型通道。

#### Scenario: 允许的 on 事件通道
- **THEN** 允许的 IPC on 事件通道 SHALL 包含：
  - `llm:chat-chunk`（已有）
  - `llm:chat-error`（新增）
- **AND** 其他未列出的 on 通道 SHALL 被拒绝
