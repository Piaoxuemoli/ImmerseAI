## ADDED Requirements

### Requirement: 意图识别与参数提取
系统 SHALL 提供 `recognizeIntent(userInput: string)` 函数，通过 LLM 识别用户自然语言中的文件操作意图并提取参数。

#### Scenario: 识别列出文件意图
- **WHEN** 用户输入"显示我的书架"、"有哪些书"、"列出所有文件"等
- **THEN** 函数 SHALL 调用 LLM 并返回 `{ intent: 'list_files', params: {} }`

#### Scenario: 识别移动文件意图
- **WHEN** 用户输入"把三体移到科幻文件夹"、"将三体.epub 移动到 SciFi/"
- **THEN** 函数 SHALL 返回 `{ intent: 'move_file', params: { source: '三体', target: '科幻' } }`
- **AND** 参数可能不完整（需要后续路径补全）

#### Scenario: 识别创建目录意图
- **WHEN** 用户输入"新建一个'哲学'分类"、"创建 Philosophy 文件夹"
- **THEN** 函数 SHALL 返回 `{ intent: 'create_directory', params: { name: '哲学' } }`

#### Scenario: 识别删除文件意图
- **WHEN** 用户输入"删除这本书"、"移除三体.epub"
- **THEN** 函数 SHALL 返回 `{ intent: 'delete_file', params: { target: '三体' } }`

#### Scenario: 无法识别意图
- **WHEN** 用户输入与文件操作无关的内容（如"这本书讲什么？"）
- **THEN** 函数 SHALL 返回 `{ intent: 'unknown', params: {} }`

#### Scenario: LLM 返回非 JSON 格式
- **WHEN** LLM 输出无法解析为 JSON
- **THEN** 函数 SHALL 抛出 `IntentParseError`，包含原始 LLM 输出

### Requirement: 路径补全
系统 SHALL 提供 `resolvePath(partial: string, bookshelfPath: string)` 函数，将不完整的文件名/路径补全为 MCP 可识别的绝对路径。

#### Scenario: 精确匹配文件名
- **WHEN** 调用 `resolvePath("三体.epub", bookshelfPath)` 且书架中存在唯一匹配
- **THEN** 系统 SHALL 调用 `window.electronAPI.mcp.listFiles(bookshelfPath)` 获取文件列表
- **AND** 返回完整路径 `{bookshelfPath}/三体.epub`

#### Scenario: 前缀匹配
- **WHEN** 调用 `resolvePath("三体", bookshelfPath)` 且书架中存在 `三体.epub`
- **THEN** 系统 SHALL 匹配到该文件并返回完整路径

#### Scenario: 多个匹配结果
- **WHEN** 模糊匹配找到多个候选文件（如"哲学"匹配到"哲学之道.epub"和"哲学导论.pdf"）
- **THEN** 函数 SHALL 返回 `{ type: 'multiple', candidates: [...] }`
- **AND** 调用方应提示用户选择正确的文件

#### Scenario: 无匹配结果
- **WHEN** 模糊匹配未找到任何文件
- **THEN** 函数 SHALL 返回 `{ type: 'not_found' }`

#### Scenario: 目录路径补全
- **WHEN** 调用 `resolvePath("科幻", bookshelfPath)` 且书架中存在 `SciFi/` 目录
- **THEN** 返回完整路径 `{bookshelfPath}/SciFi`

### Requirement: Agent 工具调用编排
系统 SHALL 提供 `executeLibrarianCommand(userInput: string, bookshelfPath: string)` 函数，编排完整的 Agent 执行流程。

#### Scenario: 列出文件操作
- **WHEN** 意图识别返回 `list_files`
- **THEN** 系统 SHALL 调用 `window.electronAPI.mcp.listFiles(bookshelfPath)`
- **AND** 将结果格式化为用户友好的文本（"找到 N 本书：书名1、书名2..."）
- **AND** 返回 `{ success: true, message: formattedResult, operation: {...} }`

#### Scenario: 移动文件操作
- **WHEN** 意图识别返回 `move_file` 且参数为 `{ source: '三体', target: '科幻' }`
- **THEN** 系统 SHALL 依次执行：
  1. 调用 `resolvePath('三体', bookshelfPath)` 补全源路径
  2. 调用 `resolvePath('科幻', bookshelfPath)` 补全目标目录路径
  3. 拼接目标完整路径为 `{targetDir}/三体.epub`
  4. 调用 `window.electronAPI.mcp.moveFile(sourcePath, targetPath)`
  5. 返回 `{ success: true, message: '已将《三体》移动到科幻文件夹', operation: {...} }`

#### Scenario: 创建目录操作
- **WHEN** 意图识别返回 `create_directory` 且参数为 `{ name: '哲学' }`
- **THEN** 系统 SHALL 调用 `window.electronAPI.mcp.createDirectory({bookshelfPath}/哲学)`
- **AND** 返回 `{ success: true, message: '已创建目录「哲学」', operation: {...} }`

#### Scenario: 删除文件操作（需确认）
- **WHEN** 意图识别返回 `delete_file`
- **THEN** 系统 SHALL 返回特殊标志 `{ needsConfirmation: true, intent: 'delete_file', params: {...} }`
- **AND** 调用方应弹出确认弹窗
- **AND** 用户确认后再次调用 `executeConfirmedDelete(params)` 真正执行删除

#### Scenario: 路径补全失败
- **WHEN** `resolvePath` 返回 `multiple` 或 `not_found`
- **THEN** 系统 SHALL 返回 `{ success: false, message: '未找到匹配文件，请提供完整文件名', operation: {...} }`

#### Scenario: MCP 调用失败
- **WHEN** `mcp.moveFile()` 或其他操作抛出错误
- **THEN** 系统 SHALL 返回 `{ success: false, message: '操作失败: {错误原因}', operation: {...} }`

### Requirement: 操作历史管理
系统 SHALL 在 Zustand Store 中维护 Agent 操作历史记录。

#### Scenario: 记录成功操作
- **WHEN** Agent 执行操作成功
- **THEN** 系统 SHALL 创建 `AgentOperation` 对象（id, timestamp, intent, input, params, result: 'success', message, duration）
- **AND** 调用 Store 的 `addAgentOperation(operation)` 添加到历史
- **AND** 如果历史记录超过 10 条，SHALL 移除最早的一条

#### Scenario: 记录失败操作
- **WHEN** Agent 执行操作失败
- **THEN** 系统 SHALL 同样记录 `AgentOperation`，但 `result` 为 `'error'`
- **AND** `message` 包含失败原因

#### Scenario: 历史持久化
- **WHEN** 添加操作记录到 Store
- **THEN** 该记录 SHALL 通过 Zustand persist middleware 持久化到 localStorage
- **AND** 应用重启后历史记录仍可访问

#### Scenario: 清空历史
- **WHEN** 用户触发清空历史操作
- **THEN** Store SHALL 将 `agentHistory` 清空为空数组
- **AND** localStorage 中的历史记录同步清除

### Requirement: useLibrarian Hook
系统 SHALL 在 `src/features/bookshelf/hooks/useLibrarian.ts` 提供 Hook，封装 Agent 状态管理和命令执行逻辑。

#### Scenario: Hook 返回值
- **WHEN** 组件调用 `useLibrarian()`
- **THEN** hook SHALL 返回以下属性：
  - `history: AgentOperation[]` — 操作历史（从 Store 读取）
  - `isExecuting: boolean` — 是否正在执行操作
  - `executeCommand: (input: string) => Promise<void>` — 执行用户命令
  - `confirmDelete: (params: DeleteParams) => Promise<void>` — 确认删除操作
  - `clearHistory: () => void` — 清空历史记录

#### Scenario: 执行命令流程
- **WHEN** 调用 `executeCommand("显示我的书架")`
- **THEN** 系统 SHALL 设置 `isExecuting: true`
- **AND** 调用 `executeLibrarianCommand` 服务函数
- **AND** 将返回的 operation 对象添加到 Store
- **AND** 设置 `isExecuting: false`

#### Scenario: 删除命令需确认
- **WHEN** 调用 `executeCommand("删除三体")` 且识别出删除意图
- **THEN** Hook SHALL 触发 `onDeleteRequested` 回调（由组件传入）
- **AND** 组件展示确认弹窗
- **AND** 用户确认后调用 `confirmDelete(params)` 完成删除

#### Scenario: MCP 未连接错误处理
- **WHEN** 执行命令但 Store 的 `connectionStatus` 不是 `'connected'`
- **THEN** 系统 SHALL 返回错误操作记录，message 为 "请先在设置中配置书架路径"
- **AND** 不调用任何 MCP 方法
