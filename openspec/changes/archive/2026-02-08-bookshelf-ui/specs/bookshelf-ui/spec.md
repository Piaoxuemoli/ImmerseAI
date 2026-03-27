## ADDED Requirements

### Requirement: 页面整体布局
BookshelfPage SHALL 采用垂直三段式布局：顶部 TopBar、中间可滚动 BookGrid 区域、固定底部 LibrarianBar。页面背景色为 white (#ffffff)，主内容区底部 SHALL 预留 padding 以避免被 LibrarianBar 遮挡。主内容区 SHALL 限制最大宽度 (max-w-7xl) 并水平居中。

#### Scenario: 正常渲染页面结构
- **WHEN** 用户导航到 `/bookshelf` 路由
- **THEN** 页面渲染 TopBar 在顶部、BookGrid 在中间、LibrarianBar 固定在底部
- **AND** 三个区域互不遮挡

#### Scenario: 内容超出视口时滚动
- **WHEN** 书籍数量使 BookGrid 高度超出视口
- **THEN** 中间区域可垂直滚动
- **AND** TopBar 保持在页面顶部
- **AND** LibrarianBar 固定在视口底部不随滚动

### Requirement: TopBar 组件
TopBar SHALL 渲染为水平导航栏，左侧显示 "ImmerseAI" 文字 logo（font-semibold, slate-900），右侧显示三个图标按钮：Settings（齿轮图标）、Import（下载图标）、GitHub（GitHub 图标）。图标按钮 SHALL 使用 lucide-react 图标和 shadcn/ui Button 的 ghost variant + icon size。

#### Scenario: 渲染 TopBar 元素
- **WHEN** BookshelfPage 加载完成
- **THEN** 顶部显示 "ImmerseAI" 文字 logo
- **AND** 右侧依次显示 Settings、Import、GitHub 三个图标按钮
- **AND** 图标颜色为 slate-500

#### Scenario: 图标按钮 hover 效果
- **WHEN** 用户 hover 任一图标按钮
- **THEN** 按钮显示 shadcn/ui ghost variant 的默认 hover 背景色

#### Scenario: 图标按钮点击（当前阶段）
- **WHEN** 用户点击 Settings、Import 或 GitHub 按钮
- **THEN** 不触发任何实际操作（预留空 onClick handler）

### Requirement: BookGrid 响应式网格
BookGrid SHALL 使用 CSS Grid 布局，列数自适应容器宽度。网格 SHALL 使用 `auto-fill` + `minmax(160px, 1fr)` 策略，列间距和行间距为 gap-6 (24px)。网格内容区域 SHALL 有水平和垂直内边距。

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

### Requirement: BookCard 封面卡片
BookCard SHALL 渲染为 2:3 宽高比的卡片，包含封面区域和信息区域。封面区域 SHALL 使用 `aspect-[2/3]` 实现固定比例。封面区域显示书名白色文字居中叠加在 muted 色调纯色背景上。封面下方显示书名（slate-900, font-semibold, text-sm）和作者名（slate-500, text-xs）。卡片 SHALL 有 rounded-lg 圆角和 slate-200 边框。

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

#### Scenario: BookCard cursor 样式
- **WHEN** 用户将鼠标移到 BookCard 上
- **THEN** 光标变为 pointer 样式（cursor-pointer）

### Requirement: LibrarianBar 固定底部聊天栏
LibrarianBar SHALL 固定定位在视口底部（fixed bottom-0），宽度 100%。背景 SHALL 为半透明白色搭配 backdrop-blur（毛玻璃效果）。内部包含一个文本输入框（shadcn/ui Input）和一个圆形发送按钮。输入框 SHALL 有 placeholder 文字 "Ask Librarian..."。发送按钮 SHALL 使用 lucide-react ArrowUp 图标。LibrarianBar 顶部 SHALL 有 slate-200 的 1px 边框线分隔。

#### Scenario: 渲染 LibrarianBar 元素
- **WHEN** BookshelfPage 加载完成
- **THEN** 底部固定显示一个含输入框和发送按钮的横条
- **AND** 输入框显示 placeholder "Ask Librarian..."
- **AND** 发送按钮包含向上箭头图标

#### Scenario: 输入框交互
- **WHEN** 用户在 LibrarianBar 输入框中输入文字
- **THEN** 输入框正常接收和显示输入文本
- **AND** 不触发任何实际发送动作（本阶段为 UI 骨架）

#### Scenario: 发送按钮点击（当前阶段）
- **WHEN** 用户点击发送按钮
- **THEN** 不触发任何实际操作（预留空 onClick handler）

#### Scenario: LibrarianBar 始终可见
- **WHEN** 用户在 BookGrid 区域上下滚动
- **THEN** LibrarianBar 保持固定在视口底部不动

### Requirement: Mock 数据
BookshelfPage SHALL 包含 6 本书的静态 mock 数据，数据结构 SHALL 完全对齐 `shared/types/index.ts` 中定义的 `Book` 接口。每本书包含 id、title、author、path 和 isIndexed 字段。mock 数据 SHALL 涵盖中文和英文书名。

#### Scenario: 渲染 6 本 mock 书籍
- **WHEN** BookshelfPage 加载完成
- **THEN** BookGrid 中显示 6 张 BookCard
- **AND** 每张卡片显示对应的书名和作者

#### Scenario: Mock 数据类型安全
- **WHEN** mock 数据定义为 `Book[]` 类型
- **THEN** TypeScript 编译通过，无类型错误

### Requirement: 设计风格一致性
所有书架页组件 SHALL 严格遵循 Notion 极简主义风格。色板限于 slate 系列：slate-900（主文字）、slate-500（次文字）、slate-200（边框）、white/slate-50（背景）。禁止使用渐变色、重投影。仅使用 shadow-sm 用于有限的提升元素。字体使用 Inter / system-ui。

#### Scenario: 视觉一致性检查
- **WHEN** 审查所有组件的 Tailwind 类名
- **THEN** 仅使用 slate 色板中的颜色值
- **AND** 无 gradient / bg-gradient 相关类名
- **AND** 阴影仅使用 shadow-sm 或无阴影

#### Scenario: 字体一致性
- **WHEN** 渲染任何文字内容
- **THEN** 使用 Inter 或 system-ui 字体家族
- **AND** 标题使用 font-semibold
- **AND** 正文使用 font-normal
