## ADDED Requirements

### Requirement: Citation 点击跳转到 EPUB 原文
系统 SHALL 允许用户在对话界面中点击 CitationBadge，自动切换到阅读模式并跳转到 EPUB 中引用文本的对应位置。

#### Scenario: 点击 CitationBadge 触发跳转
- **WHEN** 用户在 ChatInterface 的 MessageBubble 中点击一个 CitationBadge
- **THEN** 系统 SHALL 将 `pendingCitationCfi` 设置为该 citation 的 `cfi` 值
- **AND** 系统 SHALL 将 `readerMode` 切换为 `'read'`

#### Scenario: 阅读器响应跳转信号
- **WHEN** `readerMode` 为 `'read'` 且 `pendingCitationCfi` 非 null 且 rendition 已初始化
- **THEN** 系统 SHALL 调用 `rendition.display(pendingCitationCfi)` 跳转到目标位置
- **AND** 系统 SHALL 重置 `pendingCitationCfi` 为 null

#### Scenario: Rendition 未就绪时的跳转
- **WHEN** `pendingCitationCfi` 被设置但 rendition 尚未初始化
- **THEN** 系统 SHALL 等待 rendition 就绪后再执行跳转
- **AND** SHALL NOT 抛出异常

### Requirement: 引用文本高亮
系统 SHALL 在跳转到引用位置后对引用文本进行视觉高亮。

#### Scenario: 跳转后添加高亮
- **WHEN** `rendition.display(cfi)` 跳转完成
- **THEN** 系统 SHALL 调用 `rendition.annotations.highlight(cfi)` 添加高亮
- **AND** 高亮样式 SHALL 使用 amber 半透明背景色（`rgba(251, 191, 36, 0.3)`）

#### Scenario: 清除旧高亮
- **WHEN** 用户点击新的 CitationBadge 触发第二次跳转
- **THEN** 系统 SHALL 先清除上一次的高亮（`rendition.annotations.remove(oldCfi, 'highlight')`）
- **AND** 再添加新高亮

#### Scenario: CFI 不支持高亮的降级
- **WHEN** `rendition.annotations.highlight(cfi)` 调用失败（CFI 非 range 格式）
- **THEN** 系统 SHALL 静默忽略高亮错误
- **AND** 跳转功能 SHALL 正常工作（降级为仅跳转不高亮）

### Requirement: 模式切换过渡动画
系统 SHALL 使用 framer-motion AnimatePresence 确保 chat → read 模式切换平滑。

#### Scenario: chat 切换到 read 的过渡
- **WHEN** 用户点击 CitationBadge 触发模式从 `'chat'` 切换到 `'read'`
- **THEN** chat 视图 SHALL 执行退出动画（opacity 淡出）
- **AND** read 视图 SHALL 执行入场动画（opacity 淡入）
- **AND** 使用现有 `ReaderPage` 中的 `pageVariants` 和 `pageTransition` 配置

#### Scenario: 从 read 返回 chat 时保持上下文
- **WHEN** 用户通过 ModeToggle 切换回 `'chat'` 模式
- **THEN** ChatInterface SHALL 渲染之前的完整消息列表
- **AND** 流式生成状态（`isGenerating`、`streamingContent`）SHALL 保持不变
- **AND** 输入框中未发送的文本 SHALL 保留

### Requirement: 回调链路完整性
系统 SHALL 建立从 CitationBadge 到 useReader 的完整回调链路。

#### Scenario: ChatInterface 注入 onCitationClick
- **WHEN** ChatInterface 渲染 MessageBubble
- **THEN** SHALL 传递 `onCitationClick` 回调给每个 MessageBubble
- **AND** 回调接收 `cfi: string` 参数

#### Scenario: MessageBubble 传递到 CitationBadge
- **WHEN** MessageBubble 渲染 CitationBadge 列表
- **AND** `onCitationClick` prop 存在
- **THEN** SHALL 为每个 CitationBadge 传递 `onClick={() => onCitationClick(citation.cfi)}`

#### Scenario: CitationBadge 可点击状态
- **WHEN** CitationBadge 接收到 `onClick` prop
- **THEN** 按钮 SHALL 启用（`disabled={false}`）
- **AND** hover 时显示 `cursor-pointer` 和 `bg-slate-100` 效果
