## Requirements

### Requirement: OpenAI SDK Client 管理
系统 SHALL 在 `electron/main/llm-handler.ts` 中维护一个模块级缓存的 `OpenAI` client 实例。当 provider、apiKey 或 baseUrl 任一变更时，系统 SHALL 销毁旧实例并重建新实例。

#### Scenario: 首次创建 Client
- **WHEN** `llm:chat` handler 首次被调用
- **AND** 缓存中无 Client 实例
- **THEN** 系统根据当前 provider 配置创建 `new OpenAI({ apiKey, baseURL })` 实例
- **AND** 将 `{ client, configHash }` 元组存入模块级缓存

#### Scenario: 配置变更时重建 Client
- **WHEN** `llm:chat` handler 被调用
- **AND** 当前配置的 hash 与缓存中的 configHash 不匹配
- **THEN** 系统丢弃旧 Client 实例
- **AND** 创建新的 `OpenAI` 实例
- **AND** 更新缓存中的 `{ client, configHash }` 元组

#### Scenario: 配置未变更时复用 Client
- **WHEN** `llm:chat` handler 被调用
- **AND** 当前配置的 hash 与缓存中的 configHash 匹配
- **THEN** 系统直接使用缓存的 Client 实例
- **AND** 不创建新实例

### Requirement: Provider 路由
系统 SHALL 维护一个 `PROVIDER_BASE_URLS` 常量映射表，将 provider 名称映射到 API 端点 URL。

#### Scenario: 已知 Provider 解析
- **WHEN** 配置中 provider 为 `'deepseek'`
- **THEN** baseURL 解析为 `'https://api.deepseek.com'`
- **WHEN** 配置中 provider 为 `'kimi'` 或 `'moonshot'`
- **THEN** baseURL 解析为 `'https://api.moonshot.cn/v1'`
- **WHEN** 配置中 provider 为 `'openai'`
- **THEN** baseURL 解析为 `'https://api.openai.com/v1'`

#### Scenario: 自定义 Provider
- **WHEN** 配置中 provider 为 `'custom'`
- **THEN** 系统使用 `AppConfig.llm.baseUrl` 作为 baseURL
- **AND** baseUrl 不得为空字符串

#### Scenario: 默认 Provider
- **WHEN** 配置中未指定 provider
- **THEN** 系统默认使用 `'deepseek'` 作为 provider

### Requirement: 流式 Chat Completion 调用
系统 SHALL 使用 `openai` SDK 的 `client.chat.completions.create()` 方法执行流式调用，并将响应逐 chunk 通过 IPC event 发送到渲染进程。

#### Scenario: 正常流式调用
- **WHEN** `llm:chat` handler 接收 `messages: Message[]` 和 `config: LlmConfig`
- **THEN** 系统将 `Message[]` 转换为 OpenAI 格式的 `ChatCompletionMessageParam[]`
- **AND** 调用 `client.chat.completions.create({ model, messages, stream: true, temperature, max_tokens })`
- **AND** 对返回的 `AsyncIterable` 逐 chunk 提取 `chunk.choices[0]?.delta?.content`
- **AND** 非空 content 通过 `event.sender.send('llm:chat-chunk', content)` 发送
- **AND** 流结束后发送 `event.sender.send('llm:chat-chunk', '[DONE]')`

#### Scenario: 空 delta 过滤
- **WHEN** 流中某个 chunk 的 `delta.content` 为 `undefined` 或空字符串
- **THEN** 系统跳过该 chunk，不发送 IPC event

#### Scenario: 渲染进程已销毁时提前终止
- **WHEN** 流式传输过程中 `event.sender.isDestroyed()` 返回 `true`
- **THEN** 系统立即跳出 `for await` 循环
- **AND** 不再发送后续 chunk 或 `[DONE]`

### Requirement: 默认配置合并
系统 SHALL 导出 `DEFAULT_LLM_CONFIG` 常量，在每次 `llm:chat` 调用时与传入的 `LlmConfig` 合并。

#### Scenario: 部分配置覆盖
- **WHEN** 调用方传入 `{ temperature: 0.3 }`
- **THEN** 系统合并为 `{ temperature: 0.3, maxTokens: 2048, model: 'deepseek-chat' }`
- **AND** 使用扩展运算符 `{ ...DEFAULT_LLM_CONFIG, ...config }` 合并

#### Scenario: 完整配置覆盖
- **WHEN** 调用方传入所有字段
- **THEN** 传入值完全覆盖默认值

#### Scenario: 默认值定义
- **WHEN** 系统初始化默认配置
- **THEN** `temperature` 默认为 `0.7`
- **AND** `maxTokens` 默认为 `2048`
- **AND** `model` 默认为 `'deepseek-chat'`

### Requirement: 错误分级处理
系统 SHALL 对 LLM API 调用中的异常进行分类处理，区分初始化错误和流中错误；**并产出与 llm-error-classification 一致的 code 及用户可读（建议中文）message，供渲染进程展示。**

#### Scenario: API Key 未配置
- **WHEN** `llm:chat` handler 被调用
- **AND** safeStorage 中未找到 API Key（空字符串）
- **THEN** handler 通过 Promise rejection 或 `llm:chat-error` 抛出错误
- **AND** 错误 code 为 `invalid_key`（或兼容 `API_KEY_NOT_CONFIGURED`）
- **AND** message 为用户可读的简短文案（如「API Key 未配置，请在设置中填写」）

#### Scenario: 401 认证失败
- **WHEN** LLM API 返回 HTTP 401
- **THEN** 系统通过 `event.sender.send('llm:chat-error', { code: 'invalid_key', message })` 发送错误
- **AND** message 为用户可读文案（如「API Key 无效或未授权」）
- **AND** 随后发送 `'[DONE]'` 关闭流

#### Scenario: 429 限流
- **WHEN** LLM API 返回 HTTP 429
- **AND** OpenAI SDK 自动重试（maxRetries: 2）后仍失败
- **THEN** 系统通过 `event.sender.send('llm:chat-error', { code: 'rate_limited', message })` 发送错误
- **AND** message 为用户可读文案（如「请求过于频繁，请稍后再试」）
- **AND** 随后发送 `'[DONE]'` 关闭流

#### Scenario: 网络超时或断开
- **WHEN** LLM API 调用因网络问题超时或断开（如 ECONNREFUSED、ETIMEDOUT）
- **THEN** 系统通过 `event.sender.send('llm:chat-error', { code: 'network_error', message })` 发送错误
- **AND** message 为用户可读文案（如「网络连接失败，请检查网络」）
- **AND** 随后发送 `'[DONE]'` 关闭流

#### Scenario: 服务端错误
- **WHEN** LLM API 返回 HTTP 5xx 或服务端异常
- **THEN** 系统通过 `event.sender.send('llm:chat-error', { code: 'server_error', message })` 发送错误
- **AND** message 为用户可读文案（如「服务暂时不可用，请稍后再试」）
- **AND** 随后发送 `'[DONE]'` 关闭流

#### Scenario: 通用异常
- **WHEN** 流式传输过程中发生未分类的异常
- **THEN** 系统通过 `event.sender.send('llm:chat-error', { code: 'unknown', message: String(error) 或用户可读兜底文案 })` 发送错误
- **AND** 随后发送 `'[DONE]'` 关闭流

### Requirement: SDK 配置
系统 SHALL 在创建 `OpenAI` 实例时设置合理的重试和超时策略。

#### Scenario: 重试配置
- **WHEN** 创建 `OpenAI` client 实例
- **THEN** `maxRetries` SHALL 设置为 `2`

#### Scenario: 超时配置
- **WHEN** 创建 `OpenAI` client 实例
- **THEN** `timeout` SHALL 设置为 `30000`（30 秒）
