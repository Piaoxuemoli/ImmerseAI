## ADDED Requirements

### Requirement: 笔记意图检测
系统 SHALL 提供 `detectNoteIntent(message: string)` 工具函数，判断用户消息是否包含记笔记意图。

#### Scenario: 识别中文记笔记指令
- **WHEN** 用户消息包含"记笔记"、"做笔记"、"记一下"、"写笔记"、"帮我记"中的任意一个
- **THEN** 函数 SHALL 返回 `{ isNote: true, isAppend: false, topic: extractedTopic }`
- **AND** `topic` 为从消息中提取的主题文本（如果有），否则为 `undefined`

#### Scenario: 识别追加模式
- **WHEN** 用户消息包含"追加"、"补充"、"继续记"中的任意一个，且同时包含记笔记意图关键词
- **THEN** 函数 SHALL 返回 `{ isNote: true, isAppend: true, topic: extractedTopic }`

#### Scenario: 识别英文笔记指令
- **WHEN** 用户消息包含 "take note"、"note this"、"write note" 中的任意一个（大小写不敏感）
- **THEN** 函数 SHALL 返回 `{ isNote: true, isAppend: false, topic: extractedTopic }`

#### Scenario: 非笔记消息不触发
- **WHEN** 用户消息仅讨论"笔记"概念（如"你觉得做笔记有用吗？"）但不包含动作关键词
- **THEN** 函数 SHALL 返回 `{ isNote: false }`

#### Scenario: 空消息
- **WHEN** 用户消息为空字符串或仅含空白字符
- **THEN** 函数 SHALL 返回 `{ isNote: false }`

### Requirement: 笔记内容生成
系统 SHALL 提供 `generateNoteContent(messages: Message[], topic?: string)` 函数，调用 LLM 生成结构化 Markdown 笔记。

#### Scenario: 生成完整笔记
- **WHEN** 调用 `generateNoteContent(messages)` 且消息列表非空
- **THEN** 系统 SHALL 构造笔记专用 system prompt
- **AND** 将最近 10 条对话消息（或全部，取较少者）作为上下文传入
- **AND** 调用 `window.electronAPI.llm.chat()` 获取 LLM 响应
- **AND** 收集完整响应文本（非流式）作为笔记内容返回

#### Scenario: 笔记 Markdown 结构
- **WHEN** LLM 生成笔记内容
- **THEN** 笔记 SHALL 包含以下 Markdown 结构：
  - `# {主题}` 一级标题
  - `> 📖 来源：{书名} | 📅 {日期}` 元信息引用块
  - `## 要点` 对话中的关键信息
  - `## 原文摘录` 对话中引用的书籍原文（如有）
  - `## 感想` 对话中的用户观点和 AI 分析

#### Scenario: 带主题生成
- **WHEN** 调用 `generateNoteContent(messages, "存在主义")` 传入明确主题
- **THEN** LLM system prompt SHALL 指定围绕该主题组织笔记内容
- **AND** 笔记标题 SHALL 包含该主题

#### Scenario: 无主题自动总结
- **WHEN** 调用 `generateNoteContent(messages)` 未传入主题
- **THEN** LLM SHALL 自动从对话上下文中总结一个主题
- **AND** 将总结的主题用作笔记标题

#### Scenario: LLM 调用失败
- **WHEN** `window.electronAPI.llm.chat()` 调用失败
- **THEN** 函数 SHALL 抛出错误，错误消息包含 "笔记生成失败" 前缀

### Requirement: 笔记文件写入
系统 SHALL 提供 `writeNote(bookTitle: string, topic: string, content: string, append: boolean)` 函数，通过 MCP 将笔记写入本地文件系统。

#### Scenario: 新建笔记文件
- **WHEN** 调用 `writeNote("三体", "黑暗森林法则", content, false)`
- **THEN** 系统 SHALL 构造文件路径为 `{bookshelfPath}/notes/三体-2026-02-09-黑暗森林法则.md`
- **AND** 调用 `window.electronAPI.mcp.writeFile(path, content)`
- **AND** 返回 `{ success: true, filePath: path }`

#### Scenario: 文件名安全处理
- **WHEN** 书名或主题包含文件系统不安全字符（`/\:*?"<>|`）
- **THEN** 系统 SHALL 将这些字符替换为 `-`
- **AND** 保留中文字符、英文字母和数字

#### Scenario: 追加到已有笔记
- **WHEN** 调用 `writeNote(bookTitle, topic, newContent, true)` 且目标文件已存在
- **THEN** 系统 SHALL 先调用 `window.electronAPI.mcp.readFile(path)` 获取现有内容
- **AND** 在现有内容末尾追加 `\n\n---\n\n` + newContent
- **AND** 调用 `window.electronAPI.mcp.writeFile(path, combinedContent)` 覆写

#### Scenario: 追加模式但文件不存在
- **WHEN** 调用 `writeNote(bookTitle, topic, content, true)` 但目标文件不存在（readFile 失败）
- **THEN** 系统 SHALL 降级为新建模式
- **AND** 直接调用 `writeFile(path, content)` 创建新文件

#### Scenario: notes 目录不存在
- **WHEN** `writeFile` 因 notes/ 目录不存在而失败
- **THEN** 系统 SHALL 尝试通过 MCP 创建 `{bookshelfPath}/notes/` 目录
- **AND** 重试 `writeFile`

#### Scenario: MCP 未连接
- **WHEN** 尝试写入但 MCP 连接状态不是 'connected'
- **THEN** 函数 SHALL 抛出错误，消息为 "请先在设置中配置书架路径并连接 MCP"

#### Scenario: 写入失败
- **WHEN** `writeFile` 调用失败（权限不足等）
- **THEN** 函数 SHALL 返回 `{ success: false, error: errorMessage }`

### Requirement: 笔记流程编排
系统 SHALL 在 `useChat` hook 中编排完整的记笔记流程。

#### Scenario: 完整笔记流程（新建）
- **WHEN** `sendMessage` 被调用且 `detectNoteIntent` 返回 `isNote: true, isAppend: false`
- **THEN** 系统 SHALL 依次执行：
  1. 追加用户消息到 Store
  2. 设置 `isGenerating(true)`
  3. 在对话中插入 "正在生成笔记..." 的临时 assistant 消息
  4. 调用 `generateNoteContent` 生成笔记内容
  5. 调用 `writeNote` 写入文件
  6. 移除临时消息，插入 NoteConfirmation 类型的 assistant 消息
  7. 设置 `isGenerating(false)`

#### Scenario: 完整笔记流程（追加）
- **WHEN** `sendMessage` 被调用且 `detectNoteIntent` 返回 `isNote: true, isAppend: true`
- **AND** Store 中存在 `lastNotePath`（上次写入的笔记路径）
- **THEN** 系统 SHALL 执行与新建相同的流程，但 `writeNote` 的 `append` 参数为 `true`
- **AND** 使用 `lastNotePath` 对应的文件

#### Scenario: 追加但无历史笔记
- **WHEN** 检测到追加意图但 `lastNotePath` 不存在
- **THEN** 系统 SHALL 降级为新建模式
- **AND** 在确认消息中提示 "未找到上次笔记，已创建新笔记"

#### Scenario: 生成或写入失败
- **WHEN** 笔记流程中任何步骤失败
- **THEN** 系统 SHALL 移除临时消息
- **AND** 插入错误类型的 assistant 消息，内容包含 `"[笔记错误] "` 前缀和具体失败原因
- **AND** 设置 `isGenerating(false)`

### Requirement: 笔记状态管理
系统 SHALL 在 Zustand Store 中维护笔记相关状态。

#### Scenario: lastNotePath 存储
- **WHEN** 笔记成功写入
- **THEN** Store SHALL 更新 `lastNotePath` 为写入的文件路径
- **AND** 该状态通过 persist middleware 持久化

#### Scenario: lastNotePath 跟随书籍切换清空
- **WHEN** 用户切换 `selectedBookId`
- **THEN** Store SHALL 清空 `lastNotePath` 为 null
