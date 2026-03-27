## MODIFIED Requirements

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

#### Scenario: Citations 渲染（含点击跳转）
- **WHEN** 消息包含非空 `citations` 数组
- **THEN** 系统 SHALL 在消息文本下方为每个 Citation 渲染一个 `CitationBadge`
- **AND** 如果 `onCitationClick` prop 存在，SHALL 为每个 CitationBadge 传递 `onClick={() => onCitationClick(citation.cfi)}`

#### Scenario: 入场动画
- **WHEN** MessageBubble 首次渲染
- **THEN** SHALL 使用 framer-motion `motion.div` 执行入场动画
- **AND** 初始状态 `opacity: 0, y: 10`
- **AND** 动画结束状态 `opacity: 1, y: 0`
- **AND** transition duration 为 80ms

### Requirement: CitationBadge 引用标签组件
系统 SHALL 在 `src/features/chat/components/CitationBadge.tsx` 提供引用来源的展示标签。

#### Scenario: 渲染内容
- **WHEN** 渲染一个 Citation
- **THEN** 标签 SHALL 显示 📎 图标（lucide-react `Paperclip`）
- **AND** 显示 `chapter` 名称
- **AND** 显示 `score` 转换为百分比（如 0.85 → "85%"）

#### Scenario: 可点击状态
- **WHEN** CitationBadge 接收到 `onClick` prop
- **THEN** 按钮 SHALL 启用（`disabled={false}`）
- **AND** hover 时 SHALL 显示 `cursor-pointer` 和 `bg-slate-100` 效果

#### Scenario: 不可点击状态
- **WHEN** CitationBadge 未接收 `onClick` prop
- **THEN** 按钮 SHALL 禁用（`disabled={true}`）
- **AND** 显示 `cursor-default`
