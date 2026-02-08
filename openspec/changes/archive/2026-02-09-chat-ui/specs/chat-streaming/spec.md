## ADDED Requirements

### Requirement: useChat Hook 接口
系统 SHALL 在 `src/features/chat/hooks/useChat.ts` 提供 `useChat` hook，封装 LLM 流式调用和消息状态管理的完整逻辑。

#### Scenario: Hook 返回值
- **WHEN** 组件调用 `useChat()`
- **THEN** hook SHALL 返回以下属性：
  - `messages: Message[]` — 当前会话的消息列表（从 Store 读取）
  - `streamingContent: string` — 当前正在流式生成的 AI 回复内容
  - `isGenerating: boolean` — 是否正在生成（从 Store 读取）
  - `sendMessage: (content: string) => Promise<void>` — 发送消息并触发 LLM 流式调用
  - `stopGenerating: () => void` — 中止当前流式生成

### Requirement: 发送消息流程
系统 SHALL 在 `sendMessage` 调用时执行完整的消息发送和流式接收流程。

#### Scenario: 首次发送创建 ChatSession
- **WHEN** `sendMessage(content)` 被调用
- **AND** Store 的 `currentSession` 为 null
- **THEN** 系统 SHALL 创建新 `ChatSession` 对象（UUID、关联 `selectedBookId` 和 `activePersonaId`、空消息列表、当前时间戳）
- **AND** 调用 Store 的 `setCurrentSession()` 写入

#### Scenario: 追加用户消息
- **WHEN** `sendMessage(content)` 被调用
- **THEN** 系统 SHALL 创建 `Message` 对象（role: 'user'，生成 UUID，当前时间戳）
- **AND** 调用 Store 的 `addMessage()` 追加到当前会话

#### Scenario: 调用 LLM API
- **WHEN** 用户消息已追加到 Store
- **THEN** 系统 SHALL 调用 Store 的 `setIsGenerating(true)`
- **AND** 清空 `streamingContent` 为空字符串
- **AND** 调用 `window.electronAPI.llm.chat(messages, config)` 获取 `ReadableStream<string>`
- **AND** `messages` 参数 SHALL 包含当前 session 的完整消息历史（含本次用户消息）
- **AND** 如果存在活跃 Persona 的 `systemPrompt`，SHALL 在 messages 开头插入 `{ role: 'system', content: systemPrompt }` 消息

#### Scenario: 流式读取与打字机效果
- **WHEN** `ReadableStream` 返回成功
- **THEN** 系统 SHALL 使用 `stream.getReader()` 获取 reader
- **AND** 循环调用 `reader.read()` 读取 chunk
- **AND** 每次读到非空 chunk 时，将其 append 到 `streamingContent` state
- **AND** React 重渲染产生逐字打字效果

#### Scenario: 流式完成
- **WHEN** `reader.read()` 返回 `{ done: true }`
- **THEN** 系统 SHALL 创建完整的 assistant `Message` 对象（content 为全部 `streamingContent`）
- **AND** 调用 Store 的 `addMessage()` 持久化到会话
- **AND** 清空 `streamingContent` 为空字符串
- **AND** 调用 Store 的 `setIsGenerating(false)`

### Requirement: 流式错误处理
系统 SHALL 在流式调用的各阶段提供完整的错误处理。

#### Scenario: LLM API 调用失败
- **WHEN** `window.electronAPI.llm.chat()` 的 Promise reject
- **THEN** 系统 SHALL 调用 Store 的 `setIsGenerating(false)`
- **AND** 清空 `streamingContent`
- **AND** 将错误信息作为 assistant 消息追加到会话（content 前缀 `"[错误] "`）

#### Scenario: 流式读取中断
- **WHEN** `reader.read()` 在循环中抛出异常
- **THEN** 系统 SHALL 调用 `reader.cancel()` 释放资源
- **AND** 如果已有部分 `streamingContent`，SHALL 将其作为不完整的 assistant 消息保存
- **AND** 调用 Store 的 `setIsGenerating(false)`

### Requirement: 中止生成
系统 SHALL 支持用户主动中止正在进行的流式生成。

#### Scenario: 调用 stopGenerating
- **WHEN** `stopGenerating()` 被调用且 `isGenerating` 为 true
- **THEN** 系统 SHALL 调用当前 reader 的 `cancel()` 方法
- **AND** 将已有的 `streamingContent` 作为 assistant 消息保存到 Store（如果非空）
- **AND** 调用 Store 的 `setIsGenerating(false)`
- **AND** 清空 `streamingContent`

### Requirement: 组件卸载清理
系统 SHALL 在 useChat 所在组件卸载时正确清理流式资源。

#### Scenario: 组件卸载时流仍在进行
- **WHEN** 组件卸载（useEffect cleanup 触发）
- **AND** 当前存在活跃的 reader
- **THEN** 系统 SHALL 调用 `reader.cancel()` 中止流
- **AND** 调用 Store 的 `setIsGenerating(false)`

#### Scenario: 组件卸载时无活跃流
- **WHEN** 组件卸载
- **AND** 当前无活跃的 reader
- **THEN** cleanup 函数 SHALL 不执行任何操作
