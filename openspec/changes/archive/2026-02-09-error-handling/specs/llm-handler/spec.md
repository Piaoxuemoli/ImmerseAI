## MODIFIED Requirements

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
