## 1. 依赖安装

- [x] 1.1 安装 shadcn/ui Input 组件: `npx shadcn-ui@latest add input`
- [x] 1.2 验证 lucide-react 已可用 (`import { Settings, Download, Github, ArrowUp } from 'lucide-react'`)

## 2. TopBar 组件

- [x] 2.1 创建 `src/features/bookshelf/components/TopBar.tsx` 文件
- [x] 2.2 实现左侧 "ImmerseAI" 文字 logo (text-xl font-semibold text-slate-900)
- [x] 2.3 实现右侧三个图标按钮: Settings (齿轮), Import (Download), GitHub (Github)
- [x] 2.4 图标按钮使用 shadcn/ui Button variant="ghost" size="icon", 图标颜色 text-slate-500
- [x] 2.5 TopBar 使用 flex justify-between items-center 布局, 添加 border-b border-slate-200 底边框和 px-6 py-3 内边距

## 3. BookCard 组件

- [x] 3.1 创建 `src/features/bookshelf/components/BookCard.tsx` 文件
- [x] 3.2 定义 COVER_COLORS 常量数组 (6 个 muted 色调: slate-700, red-900, emerald-800, amber-800, sky-900, violet-900)
- [x] 3.3 实现 2:3 宽高比封面区域 (aspect-[2/3] rounded-lg overflow-hidden)
- [x] 3.4 封面区域内白色书名居中显示 (flex items-center justify-center, text-white font-semibold)
- [x] 3.5 封面下方显示书名 (text-sm font-semibold text-slate-900 truncate) 和作者 (text-xs text-slate-500 truncate)
- [x] 3.6 实现 hover 缩放效果 (hover:scale-[1.03] transition-transform duration-200)
- [x] 3.7 添加 cursor-pointer 和 border border-slate-200 rounded-lg
- [x] 3.8 Props 接口: `{ book: Book; index: number; onClick?: () => void }`

## 4. BookGrid 组件

- [x] 4.1 创建 `src/features/bookshelf/components/BookGrid.tsx` 文件
- [x] 4.2 实现 CSS Grid 布局: `grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6`
- [x] 4.3 添加内边距 px-6 py-6
- [x] 4.4 Props 接口: `{ books: Book[] }`, 遍历 books 渲染 BookCard
- [x] 4.5 将 index 传递给 BookCard 用于封面色板循环分配

## 5. LibrarianBar 组件

- [x] 5.1 创建 `src/features/bookshelf/components/LibrarianBar.tsx` 文件
- [x] 5.2 实现固定底部定位: fixed bottom-0 left-0 right-0
- [x] 5.3 添加毛玻璃背景: bg-white/80 backdrop-blur-sm, 顶部 border-t border-slate-200
- [x] 5.4 内部 flex 布局: shadcn/ui Input (placeholder "Ask Librarian...") + 发送按钮
- [x] 5.5 发送按钮使用 Button variant="default" size="icon" + ArrowUp 图标, 圆角 rounded-full
- [x] 5.6 内边距 px-6 py-4, 输入框和按钮间距 gap-3
- [x] 5.7 按钮和输入框暂为空操作 (预留 onClick/onSubmit handler)

## 6. BookshelfPage 组装

- [x] 6.1 重写 `src/features/bookshelf/BookshelfPage.tsx`, 移除占位内容
- [x] 6.2 定义 MOCK_BOOKS 常量: 6 本书, 类型为 `Book[]`, 包含中英文书名
- [x] 6.3 组装布局: TopBar + ScrollArea(BookGrid) + LibrarianBar
- [x] 6.4 主内容区添加 max-w-7xl mx-auto 限制最大宽度
- [x] 6.5 底部预留 LibrarianBar 空间: pb-20
- [x] 6.6 页面背景色 bg-white, 高度 min-h-screen

## 7. 验证

- [x] 7.1 TypeScript 编译检查: `npx tsc --noEmit` 零错误
- [x] 7.2 生产构建检查: `npm run build` 成功
- [x] 7.3 视觉检查: 所有组件仅使用 slate 色板, 无渐变/重投影
- [x] 7.4 响应式检查: 调整窗口宽度, 网格列数自适应变化
- [x] 7.5 BookCard hover 缩放效果正常
- [x] 7.6 LibrarianBar 固定底部, 滚动时不移动
