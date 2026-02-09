## MODIFIED Requirements

### Requirement: 页面整体布局
BookshelfPage SHALL 采用垂直三段式布局：顶部 TopBar、中间可滚动内容区、固定底部 LibrarianBar。页面背景色为 white (#ffffff)，主内容区底部 SHALL 预留 padding 以避免被 LibrarianBar 遮挡。主内容区 SHALL 限制最大宽度 (max-w-7xl) 并水平居中。**数据来源**：books 与连接状态 SHALL 来自 `useBookshelf()` hook，不得使用硬编码 MOCK_BOOKS。

#### Scenario: 正常渲染页面结构
- **WHEN** 用户导航到 `/bookshelf` 路由
- **THEN** 页面渲染 TopBar 在顶部、中间内容区、LibrarianBar 固定在底部
- **AND** 三个区域互不遮挡

#### Scenario: 内容超出视口时滚动
- **WHEN** 书籍数量使中间内容区高度超出视口
- **THEN** 中间区域可垂直滚动
- **AND** TopBar 保持在页面顶部
- **AND** LibrarianBar 固定在视口底部不随滚动

#### Scenario: 数据来自 useBookshelf
- **WHEN** BookshelfPage 渲染
- **THEN** 必须调用 `useBookshelf()` 获取 books、connectionStatus、isLoading、error、mountBookshelf 等
- **AND** books 与 connectionStatus 仅从 hook/store 读取，不使用本地 mock 数组

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
- **THEN** 中间区域 SHALL 展示 Empty state（如「拖入 EPUB 文件」或引导添加的文案 + Add 卡片）
- **AND** 不展示空 BookGrid

### Requirement: TopBar 组件
TopBar SHALL 渲染为水平导航栏，左侧显示 "ImmerseAI" 文字 logo（font-semibold, slate-900），右侧显示三个图标按钮：Settings、Import、GitHub。图标按钮 SHALL 使用 lucide-react 和 shadcn/ui Button。**TopBar 必须接收回调 props 并执行导航或挂载。**

#### Scenario: 渲染 TopBar 元素
- **WHEN** BookshelfPage 加载完成
- **THEN** 顶部显示 "ImmerseAI" 文字 logo
- **AND** 右侧依次显示 Settings、Import、GitHub 三个图标按钮
- **AND** 图标颜色为 slate-500

#### Scenario: Settings 按钮点击
- **WHEN** 用户点击 Settings 按钮
- **THEN** 系统 SHALL 执行 `navigate('/settings')`（或通过 onSettingsClick 回调由父组件传入 navigate）

#### Scenario: Import 按钮点击
- **WHEN** 用户点击 Import（下载）按钮
- **THEN** 系统 SHALL 调用挂载书架流程（如 useBookshelf 的 `mountBookshelf()`，或通过 onImportClick 回调传入）

#### Scenario: GitHub 按钮点击
- **WHEN** 用户点击 GitHub 按钮
- **THEN** 系统 SHALL 打开外链（如 `window.open('https://github.com/...')`）

#### Scenario: 图标按钮 hover 效果
- **WHEN** 用户 hover 任一图标按钮
- **THEN** 按钮显示 shadcn/ui ghost variant 的默认 hover 背景色

### Requirement: BookGrid 响应式网格
BookGrid SHALL 使用 CSS Grid 布局，列数自适应，并**接收 onBookClick 回调，传递给每个 BookCard**。

#### Scenario: 宽屏展示（≥1280px）
- **WHEN** 视口宽度 ≥1280px
- **THEN** BookGrid 展示 5-6 列书籍卡片

#### Scenario: 中等屏幕（768px-1280px）
- **WHEN** 视口宽度在 768px 到 1280px 之间
- **THEN** BookGrid 自动调整为 3-4 列

#### Scenario: 窄屏（<768px）
- **WHEN** 视口宽度 <768px
- **THEN** BookGrid 自动调整为 2-3 列
- **AND** 卡片仍保持 2:3 宽高比

#### Scenario: onBookClick 传递
- **WHEN** BookGrid 接收 props `books` 与 `onBookClick: (bookId: string) => void`
- **THEN** 每个 BookCard SHALL 接收 onClick 或 onBookClick，点击时调用 `onBookClick(book.id)` 或等价

### Requirement: BookCard 封面卡片
BookCard SHALL 渲染为 2:3 宽高比的卡片，包含封面区域和信息区域；**支持点击回调**。

#### Scenario: 渲染单本书卡片
- **WHEN** BookGrid 传入一本书的 Book 数据
- **THEN** 渲染一张卡片包含：纯色封面（含白色居中书名）、封面下方的书名、作者名
- **AND** 封面宽高比为 2:3

#### Scenario: 无封面图 fallback
- **WHEN** Book 数据的 coverUrl 为 undefined 或空
- **THEN** 封面区域显示预定义的 muted 纯色背景
- **AND** 背景色从预定义色板中根据 index 循环分配

#### Scenario: Hover 缩放效果
- **WHEN** 用户将鼠标悬停在 BookCard 上
- **THEN** 卡片整体应用 `scale(1.03)` 的 CSS transform 缩放
- **AND** 过渡动画持续时间为 200ms (transition-transform duration-200)

#### Scenario: BookCard 点击与导航
- **WHEN** 用户点击 BookCard
- **THEN** 系统 SHALL 调用 store `selectBook(bookId)` 并执行 `navigate(\`/reader/${bookId}\`)`（或由父组件通过 onBookClick 传入并在此回调中执行）

#### Scenario: BookCard cursor 样式
- **WHEN** 用户将鼠标移到 BookCard 上
- **THEN** 光标变为 pointer 样式（cursor-pointer）

## REMOVED Requirements

### Requirement: Mock 数据
**Reason**：书架数据改为由 useBookshelf 从 MCP 与 Store 获取，不再使用静态 mock 数组。
**Migration**：删除 BookshelfPage 中的 MOCK_BOOKS 或等效硬编码；书籍列表仅来自 `useBookshelf().books`。
