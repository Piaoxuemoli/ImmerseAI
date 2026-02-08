## ADDED Requirements

### Requirement: ChatInterface 容器组件
系统 SHALL 在 `src/features/chat/components/ChatInterface.tsx` 提供对话界面容器组件，管理消息列表渲染和滚动行为。

#### Scenario: 渲染已有消息列表
- **WHEN** ChatInterface 挂载且 Zustand Store 的 `currentSession` 包含消息
- **THEN** 系统 SHALL 为每条消息渲染一个 `MessageBubble` 组件
- **AND** 消息按 `timestamp` 升序排列（最早在上）

#### Scenario: 渲染流式生成中的 AI 消息
- **WHEN** `isGenerating` 为 true 且存在 `streamingContent`
- **THEN** 系统 SHALL 在消息列表底部额外渲染一个 `MessageBubble`，其 `content` 为当前 `streamingContent`，`role` 为 `'assistant'`
- **AND** 该气泡随 `streamingContent` 实时更新（打字机效果）

#### Scenario: 空状态展示
- **WHEN** ChatInterface 挂载且 `currentSession` 为 null 或消息列表为空
- **THEN** 系统 SHALL 展示空状态提示文本（如 "开始与角色对话..."）

#### Scenario: 自动滚动到底部
- **WHEN** 新消息添加到列表或 `streamingContent` 更新
- **AND** 用户当前滚动位置在消息列表底部附近（距底部 < 100px）
- **THEN** 系统 SHALL 自动平滑滚动到列表底部

#### Scenario: 用户手动上滚时不干扰
- **WHEN** 用户手动向上滚动查看历史消息（距底部 >= 100px）
- **AND** `streamingContent` 更新或新消息到达
- **THEN** 系统 SHALL NOT 自动滚动，保持用户当前滚动位置

#### Scenario: 组件布局
- **WHEN** ChatInterface 渲染
- **THEN** 消息列表区域 SHALL 使用 shadcn/ui `ScrollArea` 包裹
- **AND** 列表区域占满可用高度（flex-1）
- **AND** 底部为 `ChatInput` 组件，固定在容器底部

### Requirement: MessageBubble 消息气泡组件
系统 SHALL 在 `src/features/chat/components/MessageBubble.tsx` 提供单条消息的展示组件。

#### Scenario: 用户消息样式
- **WHEN** 渲染 `role: 'user'` 的消息
- **THEN** 气泡 SHALL 右对齐（`flex justify-end`）
- **AND** 背景色为 `bg-slate-100`
- **AND** 圆角为 `rounded-lg`
- **AND** 不显示头像

#### Scenario: AI 消息样式
- **WHEN** 渲染 `role: 'assistant'` 的消息
- **THEN** 气泡 SHALL 左对齐（`flex justify-start`）
- **AND** 背景色为 `bg-white`，带 `border border-slate-200`
- **AND** 圆角为 `rounded-lg`
- **AND** 左侧显示角色 Avatar

#### Scenario: AI 头像渲染
- **WHEN** 渲染 assistant 消息且 Store 中存在匹配 `activePersonaId` 的 Persona
- **THEN** Avatar SHALL 显示 Persona `name` 的首字符（中文或英文）
- **AND** Avatar 背景为 `bg-slate-800`，文字为白色
- **AND** 使用 shadcn/ui `Avatar` 组件

#### Scenario: 无 Persona 时的默认头像
- **WHEN** 渲染 assistant 消息且 Store 中无匹配的 Persona
- **THEN** Avatar SHALL 显示 "AI" 文本

#### Scenario: 消息内容渲染
- **WHEN** 渲染消息 `content`
- **THEN** 文本 SHALL 使用 `whitespace-pre-wrap` 样式保留换行
- **AND** 文字颜色为 `text-slate-900`

#### Scenario: Citations 渲染
- **WHEN** 消息包含非空 `citations` 数组
- **THEN** 系统 SHALL 在消息文本下方为每个 Citation 渲染一个 `CitationBadge`

#### Scenario: 入场动画
- **WHEN** MessageBubble 首次渲染
- **THEN** SHALL 使用 framer-motion `motion.div` 执行入场动画
- **AND** 初始状态 `opacity: 0, y: 10`
- **AND** 动画结束状态 `opacity: 1, y: 0`
- **AND** transition duration 为 80ms

### Requirement: ChatInput 输入组件
系统 SHALL 在 `src/features/chat/components/ChatInput.tsx` 提供固定在底部的消息输入区域。

#### Scenario: 基础渲染
- **WHEN** ChatInput 渲染
- **THEN** SHALL 包含一个多行文本输入框（`textarea` 或等效组件）
- **AND** 一个发送按钮（lucide-react `Send` 图标）
- **AND** 输入区域固定在容器底部，带上边框 `border-t border-slate-200`

#### Scenario: 角色名 Placeholder
- **WHEN** Store 中存在匹配 `activePersonaId` 的 Persona
- **THEN** 输入框 placeholder SHALL 为 `"对 {personaName} 说点什么..."`
- **WHEN** 无匹配 Persona
- **THEN** placeholder SHALL 为 `"输入消息..."`

#### Scenario: 发送消息
- **WHEN** 用户点击发送按钮或按 Enter 键（非 Shift+Enter）
- **AND** 输入框内容非空且 `isGenerating` 为 false
- **THEN** 系统 SHALL 调用 `useChat` 提供的 `sendMessage(content)` 方法
- **AND** 清空输入框内容

#### Scenario: Shift+Enter 换行
- **WHEN** 用户按 Shift+Enter
- **THEN** 系统 SHALL 在输入框中插入换行符
- **AND** SHALL NOT 触发发送

#### Scenario: 生成中禁用
- **WHEN** `isGenerating` 为 true
- **THEN** 发送按钮 SHALL 禁用（`disabled`）
- **AND** 按钮视觉显示为灰色不可点击状态

### Requirement: CitationBadge 引用标签组件
系统 SHALL 在 `src/features/chat/components/CitationBadge.tsx` 提供引用来源的展示标签。

#### Scenario: 渲染内容
- **WHEN** 渲染一个 Citation
- **THEN** 标签 SHALL 显示 📎 图标（lucide-react `Paperclip`）
- **AND** 显示 `chapter` 名称
- **AND** 显示 `score` 转换为百分比（如 0.85 → "85%"）

#### Scenario: 视觉样式
- **WHEN** CitationBadge 渲染
- **THEN** SHALL 使用行内标签样式（`inline-flex`）
- **AND** 背景为 `bg-slate-50`，边框 `border border-slate-200`
- **AND** 圆角 `rounded-md`，字号 `text-xs`

#### Scenario: 点击交互预留
- **WHEN** CitationBadge 被点击
- **THEN** SHALL 调用 `onClick` prop 回调（如果提供）
- **AND** 如果未提供 `onClick`，点击无效果
- **AND** 有 `onClick` 时鼠标样式为 `cursor-pointer`，无时为 `cursor-default`
