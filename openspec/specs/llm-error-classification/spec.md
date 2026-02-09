## Requirements

### Requirement: LLM 错误分类
系统 SHALL 将 LLM API 调用失败分类为以下类型之一，并产出稳定 code 与用户可读文案，供主进程与渲染进程使用。

#### Scenario: 分类枚举
- **WHEN** 主进程或 LLM 调用链处理错误
- **THEN** 错误 SHALL 被映射为以下 code 之一：
  - `network_error`：网络断开、超时、无法连接
  - `rate_limited`：API 限流（如 HTTP 429）
  - `invalid_key`：API Key 无效或未配置（如 HTTP 401、API_KEY_NOT_CONFIGURED）
  - `server_error`：服务端错误（如 HTTP 5xx）
  - `unknown`：未分类异常

#### Scenario: 用户可读文案
- **WHEN** 产出错误信息供 UI 展示
- **THEN** 系统 SHALL 同时提供简短、用户可读的文案（建议中文）
- **AND** 文案 SHALL 与 code 对应（如 invalid_key →「API Key 无效或未配置，请到设置页检查」）
- **AND** 通过现有 IPC 通道（如 `llm:chat-error`）将 `{ code, message }` 传给渲染进程

#### Scenario: 与 llm-handler 集成
- **WHEN** `electron/main/llm-handler.ts` 内 catch 到 LLM 调用异常
- **THEN** 系统 SHALL 根据异常属性（status、code、message 关键字）映射为上述 code
- **AND** 生成对应 message 并通过 `event.sender.send('llm:chat-error', { code, message })` 发送
- **AND** 渲染进程可据此展示 Toast 或内联错误
