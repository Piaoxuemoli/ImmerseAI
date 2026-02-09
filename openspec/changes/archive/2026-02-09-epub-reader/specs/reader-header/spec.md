# 阅读页顶栏规范

## 目的
定义阅读页 Header 的布局、导航和模式切换能力。

## ADDED Requirements

### Requirement: ReaderHeader 布局
ReaderHeader SHALL 包含四个区域：返回按钮、书名、角色选择按钮、模式切换按钮。

#### Scenario: 显示书名
- **WHEN** ReaderHeader 渲染
- **THEN** 居中显示当前书籍的标题
- **AND** 标题使用 `text-sm font-medium text-slate-900`

#### Scenario: 返回导航
- **WHEN** 用户点击返回按钮（ArrowLeft 图标）
- **THEN** 导航回 `/bookshelf` 页面

#### Scenario: 角色选择按钮
- **WHEN** 有活跃角色时
- **THEN** 按钮显示角色名称或 avatar
- **WHEN** 无活跃角色时
- **THEN** 按钮显示默认图标（User 图标）

### Requirement: ModeToggle 模式切换
ModeToggle SHALL 提供阅读模式和对话模式的切换按钮。

#### Scenario: 显示当前模式
- **WHEN** 当前为 read 模式
- **THEN** 阅读按钮高亮（BookOpen 图标）
- **WHEN** 当前为 chat 模式
- **THEN** 对话按钮高亮（MessageCircle 图标）

#### Scenario: 切换模式
- **WHEN** 用户点击另一个模式按钮
- **THEN** 调用 `store.toggleMode()` 切换模式
- **AND** 主内容区通过 AnimatePresence 动画过渡

### Requirement: ReaderPage 模式切换动画
ReaderPage SHALL 使用 framer-motion AnimatePresence 实现阅读和对话模式的切换。

#### Scenario: 切换到阅读模式
- **WHEN** readerMode 从 'chat' 变为 'read'
- **THEN** ChatInterface 执行退出动画（opacity 0, y 偏移）
- **AND** EpubViewer 执行入场动画（opacity 1, y 归零）
- **AND** 使用 `mode="wait"` 确保顺序执行

#### Scenario: 切换到对话模式
- **WHEN** readerMode 从 'read' 变为 'chat'
- **THEN** EpubViewer 执行退出动画
- **AND** ChatInterface 执行入场动画
