# Bookshelf UI — Delta（Empty 文案与移除 GitHub）

## MODIFIED Requirements

### Requirement: TopBar 组件
TopBar SHALL 渲染为水平导航栏，左侧显示 "ImmerseAI" 文字 logo（font-semibold, slate-900），右侧显示两个图标按钮：Settings、Import。**不显示 GitHub 图标。**

#### Scenario: 渲染 TopBar 元素
- **WHEN** BookshelfPage 加载完成
- **THEN** 顶部显示 "ImmerseAI" 文字 logo
- **AND** 右侧依次显示 Settings、Import 两个图标按钮（无 GitHub 按钮）
- **AND** 图标颜色为 slate-500

#### Scenario: Settings 按钮点击
- **WHEN** 用户点击 Settings 按钮
- **THEN** 系统 SHALL 执行 `navigate('/settings')`（或通过 onSettingsClick 回调由父组件传入 navigate）

#### Scenario: Import 按钮点击
- **WHEN** 用户点击 Import（下载）按钮
- **THEN** 系统 SHALL 调用挂载书架流程（如 useBookshelf 的 `mountBookshelf()`，或通过 onImportClick 回调传入）

#### Scenario: 图标按钮 hover 效果
- **WHEN** 用户 hover 任一图标按钮
- **THEN** 按钮显示 shadcn/ui ghost variant 的默认 hover 背景色

## REMOVED Requirements

### Requirement: GitHub 按钮点击
**Reason:** 首页/书架页移除 GitHub 入口，降低界面噪音。
**Migration:** 无；用户可通过浏览器或外部方式访问仓库。

## MODIFIED Requirements（续）

### Requirement: BookshelfPage 三种状态与空书架
BookshelfPage SHALL 根据 connectionStatus 与 books 展示三种内容状态；已连接且无书时展示 Empty state。

#### Scenario: 未连接状态
- **WHEN** `connectionStatus` 为 `'disconnected'` 或 bookshelfRootPath 为空
- **THEN** 中间区域 SHALL 展示「引导挂载」内容（如提示选择目录、或可点击触发 mountBookshelf 的入口）
- **AND** 不展示 BookGrid 或空书架占位

#### Scenario: 加载中状态
- **WHEN** `isLoading` 为 true（mountBookshelf 或 refreshBooks 进行中）
- **THEN** 中间区域 SHALL 展示加载占位（如 Skeleton）
- **AND** 不展示 BookGrid 或书籍列表

#### Scenario: 已加载有书
- **WHEN** `connectionStatus === 'connected'` 且 `books.length > 0`
- **THEN** 中间区域 SHALL 展示 BookGrid，传入 books 与 onBookClick 回调
- **AND** 用户点击某书后触发 onBookClick(bookId)

#### Scenario: 空书架状态
- **WHEN** `connectionStatus === 'connected'` 且 `books.length === 0`
- **THEN** 中间区域 SHALL 展示 Empty state（文案为「添加 .md / .txt 文件」或引导添加的说明 + Add 卡片）
- **AND** 不展示空 BookGrid
