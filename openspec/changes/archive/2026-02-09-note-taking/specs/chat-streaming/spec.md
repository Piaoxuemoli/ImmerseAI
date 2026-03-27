## MODIFIED Requirements

### Requirement: 发送消息流程
系统 SHALL 在 `sendMessage` 调用时执行完整的消息发送和流式接收流程，并支持笔记意图分支。

#### Scenario: 首次发送创建 ChatSession
- **WHEN** `sendMessage(content)` 被调用
- **AND** Store 的 `currentSession` 为 null
- **THEN** 系统 SHALL 创建新 `ChatSession` 对象（UUID、关联 `selectedBookId` 和 `activePersonaId`、空消息列表、当前时间戳）
- **AND** 调用 Store 的 `setCurrentSession()` 写入

#### Scenario: 追加用户消息
- **WHEN** `sendMessage(content)` 被调用
- **THEN** 系统 SHALL 创建 `Message` 对象（role: 'user'，生成 UUID，当前时间戳）
- **AND** 调用 Store 的 `addMessage()` 追加到当前会话

#### Scenario: 笔记意图分支
- **WHEN** 用户消息已追加到 Store
- **AND** `detectNoteIntent(content)` 返回 `isNote: true`
- **THEN** 系统 SHALL 进入笔记生成流程（而非常规 LLM 对话流程）
- **AND** 调用 Store 的 `setIsGenerating(true)`

#### Scenario: 常规对话流程（无笔记意图）
- **WHEN** 用户消息已追加到 Store
- **AND** `detectNoteIntent(content)` 返回 `isNote: false`
- **THEN** 系统 SHALL 执行原有的 LLM 流式对话流程（调用 `window.electronAPI.llm.chat`）

#### Scenario: 调用 LLM API
- **WHEN** 用户消息已追加到 Store
- **AND** 非笔记意图
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

### Requirement: useChat Hook 接口
系统 SHALL 在 `src/features/chat/hooks/useChat.ts` 提供 `useChat` hook，封装 LLM 流式调用、消息状态管理和笔记生成的完整逻辑。

#### Scenario: Hook 返回值
- **WHEN** 组件调用 `useChat()`
- **THEN** hook SHALL 返回以下属性：
  - `messages: Message[]` — 当前会话的消息列表（从 Store 读取）
  - `streamingContent: string` — 当前正在流式生成的 AI 回复内容
  - `isGenerating: boolean` — 是否正在生成（从 Store 读取）
  - `sendMessage: (content: string) => Promise<void>` — 发送消息并触发 LLM 流式调用或笔记流程
  - `stopGenerating: () => void` — 中止当前流式生成
  - `lastNotePath: string | null` — 最近一次成功写入的笔记文件路径
