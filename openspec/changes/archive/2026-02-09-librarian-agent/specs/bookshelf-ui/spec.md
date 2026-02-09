## MODIFIED Requirements

### Requirement: LibrarianBar 固定底部聊天栏
LibrarianBar SHALL 固定定位在视口底部，提供自然语言交互能力，包含输入框、发送按钮、操作历史展示区域。

#### Scenario: 渲染 LibrarianBar 元素
- **WHEN** BookshelfPage 加载完成
- **THEN** 底部固定显示输入框、发送按钮和操作历史列表
- **AND** 输入框显示 placeholder "Ask Librarian..."
- **AND** 发送按钮包含向上箭头图标（lucide-react `ArrowUp`）

#### Scenario: 输入框交互
- **WHEN** 用户在 LibrarianBar 输入框中输入文字
- **THEN** 输入框正常接收和显示输入文本
- **AND** 按 Enter 键触发命令执行

#### Scenario: 发送按钮点击
- **WHEN** 用户点击发送按钮且输入框非空
- **THEN** 系统 SHALL 调用 `useLibrarian` 的 `executeCommand(input)` 方法
- **AND** 清空输入框内容

#### Scenario: 执行中禁用输入
- **WHEN** `isExecuting` 为 true
- **THEN** 输入框和发送按钮 SHALL 禁用（`disabled`）
- **AND** 发送按钮显示 loading 状态（Loader2 旋转图标）

#### Scenario: 操作历史展示
- **WHEN** Store 的 `agentHistory` 包含操作记录
- **THEN** LibrarianBar 上方 SHALL 展示历史记录列表（最多 10 条，最新在上）
- **AND** 每条记录显示：时间戳、用户输入、操作结果（成功/失败）
- **AND** 成功操作使用绿色文字，失败操作使用红色文字

#### Scenario: 历史列表为空时不显示
- **WHEN** `agentHistory` 为空数组
- **THEN** 不渲染历史列表区域
- **AND** LibrarianBar 仅显示输入框和发送按钮

#### Scenario: LibrarianBar 始终可见
- **WHEN** 用户在 BookGrid 区域上下滚动
- **THEN** LibrarianBar 保持固定在视口底部不动

## ADDED Requirements

### Requirement: ConfirmDeleteDialog 删除确认弹窗
系统 SHALL 在 `src/features/bookshelf/components/ConfirmDeleteDialog.tsx` 提供删除文件的二次确认弹窗组件。

#### Scenario: 弹窗内容渲染
- **WHEN** 渲染 ConfirmDeleteDialog 且传入 `fileName` 和 `filePath`
- **THEN** 弹窗 SHALL 使用 shadcn/ui `AlertDialog` 组件
- **AND** 标题为 "确认删除"
- **AND** 描述为 "确定要删除《{fileName}》吗？此操作不可撤销。"
- **AND** 路径以灰色小字显示（`text-xs text-slate-500 font-mono`）

#### Scenario: 确认删除按钮
- **WHEN** 用户点击弹窗中的"确认删除"按钮
- **THEN** 触发 `onConfirm` 回调
- **AND** 关闭弹窗

#### Scenario: 取消按钮
- **WHEN** 用户点击"取消"按钮或点击弹窗外部区域
- **THEN** 触发 `onCancel` 回调
- **AND** 关闭弹窗
- **AND** 不执行删除操作

#### Scenario: 按钮样式
- **WHEN** 渲染弹窗按钮
- **THEN** "取消"按钮使用 `variant="outline"`
- **AND** "确认删除"按钮使用 `variant="destructive"`（红色警告色）

### Requirement: AgentHistoryItem 历史记录条目组件
系统 SHALL 在 `src/features/bookshelf/components/AgentHistoryItem.tsx` 提供单条操作历史的展示组件。

#### Scenario: 成功操作渲染
- **WHEN** 渲染 `result: 'success'` 的操作记录
- **THEN** 左侧显示绿色 CheckCircle 图标（lucide-react）
- **AND** 显示操作描述（来自 `operation.message`）
- **AND** 显示时间戳（相对时间，如"2 分钟前"）
- **AND** 文字颜色为 `text-slate-700`

#### Scenario: 失败操作渲染
- **WHEN** 渲染 `result: 'error'` 的操作记录
- **THEN** 左侧显示红色 XCircle 图标（lucide-react）
- **AND** 显示错误消息（来自 `operation.message`）
- **AND** 文字颜色为 `text-red-600`

#### Scenario: 时间戳格式
- **WHEN** 渲染时间戳
- **THEN** 使用相对时间格式：
  - < 1 分钟："刚刚"
  - 1-60 分钟："{N} 分钟前"
  - 1-24 小时："{N} 小时前"
  - > 24 小时："{MM-DD HH:mm}"

#### Scenario: Hover 效果
- **WHEN** 用户 hover 历史记录条目
- **THEN** 背景色变为 `bg-slate-50`
- **AND** transition 持续 150ms
