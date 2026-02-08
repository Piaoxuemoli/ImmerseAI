## Context

`electron/main/ipc-handlers.ts` 中的 `llm:chat` handler 是 mock 实现（逐字符拆分固定字符串），`app:get-safe-storage` / `app:set-safe-storage` 是空壳。spike (`docs/spikes/spike-deepseek-stream.ts`) 已验证 `openai` SDK 对 DeepSeek 端点的流式调用可行。preload 层的 `ReadableStream<string>` 封装和 `[DONE]` 终止协议已就绪，IPC channel 定义不需变更。

现需在主进程中实现两个独立模块：LLM 调用层（`llm-handler.ts`）和安全存储层（`safe-storage.ts`），然后将 `ipc-handlers.ts` 中的 mock/空壳替换为真实调用。

## Goals / Non-Goals

**Goals:**
- 使用 `openai` SDK 实现 OpenAI-compatible 流式 chat completion 调用
- 支持 DeepSeek / Kimi / Moonshot / OpenAI / 自定义端点的 provider 路由
- 通过 Electron `safeStorage` 加密存储 API Key，持久化到磁盘
- 完整的错误分级处理：网络超时、429 限流、401 认证失败、通用异常
- 将 `ipc-handlers.ts` 中三个 TODO handler 替换为真实实现

**Non-Goals:**
- 不实现非流式（一次性）调用模式 — stream 始终为 true
- 不实现多轮对话的 token 截断或上下文窗口管理 — 由调用方（chat feature）控制
- 不实现 API Key 的多用户 / 多 provider 同时存储 — 当前仅存储一组配置
- 不实现 LLM 响应的缓存或离线模式
- 不修改 preload 层或渲染进程代码 — IPC 协议保持不变

## Decisions

### D1: OpenAI SDK 单例 Client + 按需重建

**选择**：模块级缓存一个 `OpenAI` client 实例，当 provider/apiKey/baseUrl 任一变更时销毁并重建。

**替代方案**：每次 `llm:chat` 调用都 `new OpenAI()`。

**理由**：`openai` SDK 内部维护 HTTP 连接池，复用 client 可减少 TCP 握手开销。但 provider 配置可能在设置页面被用户修改，因此需要"脏标记 + 懒重建"策略，而非固定单例。实现方式：缓存 `{ client, configHash }` 元组，每次调用时比较 configHash，不匹配则重建。

### D2: Provider 路由通过 baseUrl 映射表

**选择**：维护一个 `PROVIDER_BASE_URLS: Record<string, string>` 常量表，将 provider 名称映射到对应 API 端点。`custom` provider 直接使用 `AppConfig.llm.baseUrl`。

**替代方案**：让用户总是手动输入 baseUrl。

**理由**：大部分用户只需选择 provider（如 "deepseek"），不需要知道端点 URL。映射表降低配置门槛，同时保留 `custom` 作为逃生通道。

```typescript
const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  kimi: 'https://api.moonshot.cn/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  openai: 'https://api.openai.com/v1',
}
```

### D3: 流式输出通过 IPC event 转发（保持现有协议）

**选择**：在 `llm:chat` handler 内，对 `openai` SDK 返回的 `AsyncIterable<ChatCompletionChunk>` 逐 chunk 提取 `delta.content`，通过 `event.sender.send('llm:chat-chunk', content)` 发送到渲染进程。流结束时发送 `'[DONE]'`。

**替代方案**：在主进程中攒满 N 个 token 再批量发送。

**理由**：preload 层的 `ReadableStream` 封装已基于逐 chunk 接收设计，批量模式需要修改 preload（违反 Non-Goals）。单 token 粒度延迟最低，对桌面应用而言 IPC 开销可忽略。

### D4: 错误传递使用 `llm:chat-error` IPC event

**选择**：当流式调用发生异常时，通过 `event.sender.send('llm:chat-error', { code, message })` 发送结构化错误，然后发送 `'[DONE]'` 关闭流。在 preload 端监听 `llm:chat-error` 并调用 `controller.error()`。

**替代方案**：通过 `ipcMain.handle` 的 throw 传递错误。

**理由**：流式场景下，`ipcMain.handle` 的 Promise rejection 只能在流开始前生效（如 API Key 未配置）。流开始后的错误（网络中断、429）必须通过 event channel 传递，因为 handle 的 Promise 已 resolve。需要两种错误通道并存：handle rejection（初始化错误）+ event（流中错误）。

### D5: safeStorage 持久化策略 — JSON 文件 + Buffer 编码

**选择**：使用 `electron.safeStorage.encryptString()` 加密 value，将加密后的 `Buffer` 以 `base64` 编码存入 `{app.getPath('userData')}/safe-storage.json` 文件。文件结构为 `Record<string, string>`（key → base64 encoded encrypted buffer）。

**替代方案**：使用系统 Keychain（macOS）/ Credential Manager（Windows）。

**理由**：Electron `safeStorage` 底层已使用系统级加密（macOS Keychain / Windows DPAPI / Linux libsecret），无需额外依赖。直接操作系统 Keychain API 需要 native 模块，增加复杂度。JSON 文件格式便于调试和备份。

### D6: 默认配置合并策略

**选择**：`llm-handler.ts` 导出一个 `DEFAULT_LLM_CONFIG` 常量，`llm:chat` handler 将传入的 `LlmConfig` 与默认值合并（`{ ...DEFAULT_LLM_CONFIG, ...config }`）。默认值：`temperature: 0.7`, `maxTokens: 2048`, `model: 'deepseek-chat'`。

**替代方案**：要求调用方总是传完整配置。

**理由**：渲染进程在快速调用场景（如 persona 生成）可能只传 `{ temperature: 0.3 }` 覆盖个别参数。默认值合并降低调用复杂度。

## Risks / Trade-offs

- **[API Key 首次使用前未设置]** 用户可能在未配置 Key 的情况下尝试聊天。→ 缓解：`llm:chat` handler 在调用前检查 Key 是否存在，缺失时通过 handle rejection 返回明确的 `API_KEY_NOT_CONFIGURED` 错误码，渲染进程可据此引导用户去设置页面。
- **[safeStorage 不可用]** 极少数 Linux 环境下 `safeStorage.isEncryptionAvailable()` 返回 false。→ 缓解：降级为明文存储（`Buffer.from(value).toString('base64')`），并在日志中警告。
- **[429 限流重试]** OpenAI SDK 内置自动重试（默认 2 次），但 DeepSeek 等国内 provider 的限流头可能不完全兼容。→ 缓解：设置 `maxRetries: 2` 并尊重 `retry-after` header；超出重试后将错误透传给用户。
- **[流中断后的状态清理]** 如果用户在流式接收过程中关闭窗口或切换页面，主进程的 `for await` 循环需要被打断。→ 缓解：监听 `event.sender` 的 `destroyed` 事件，在循环中检查 sender 是否仍有效，无效则提前 break。
- **[preload 层需要小幅修改]** D4 决定新增 `llm:chat-error` event channel，preload 的 `ReadableStream` 封装需要监听此事件。→ 这是对 preload-bridge 的最小修改，保持在 Modified Capabilities 范围内。
