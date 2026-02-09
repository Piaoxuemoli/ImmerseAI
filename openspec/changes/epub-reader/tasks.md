## 1. useReader Hook

- [x] 1.1 创建 `src/features/reader/hooks/useReader.ts`，定义 `useReader(bookId: string)` hook 签名，返回 `{ blobUrl, loading, error, location, setLocation, renditionRef, goToCfi }`
- [x] 1.2 实现 EPUB 加载：useEffect 中调用 `window.electronAPI.mcp.readFile(book.path)` 获取 ArrayBuffer，转为 Blob URL，管理 loading/error 状态
- [x] 1.3 实现 Blob URL 清理：useEffect cleanup 中调用 `URL.revokeObjectURL(blobUrl)`
- [x] 1.4 实现阅读进度初始化：从 `store.books` 中查找 `book.lastReadCfi` 作为初始 location
- [x] 1.5 实现 locationChanged 回调：更新 `store.setCurrentCfi(cfi)` 并更新 Book 的 `lastReadCfi` 和 `lastReadAt`
- [x] 1.6 实现 `goToCfi(cfi)` 方法：调用 `renditionRef.current?.display(cfi)`

## 2. EpubViewer 组件

- [x] 2.1 创建 `src/features/reader/components/EpubViewer.tsx`，接收 props: `blobUrl, location, onLocationChange, onRendition`
- [x] 2.2 渲染 `ReactReader` 组件，传入 url/location/locationChanged/getRendition
- [x] 2.3 在 `getRendition` 回调中设置阅读器样式：font-family Inter, font-size 18px, line-height 1.8, color slate-900
- [x] 2.4 显示 loading 状态（blobUrl 为 null 时显示加载指示器）

## 3. ReaderHeader 组件

- [x] 3.1 创建 `src/features/reader/components/ReaderHeader.tsx`，包含返回按钮（ArrowLeft）、书名、角色按钮、ModeToggle
- [x] 3.2 返回按钮：点击导航到 `/bookshelf`（使用 `useNavigate`）
- [x] 3.3 书名：从 store.books 中查找 selectedBookId 对应的 title
- [x] 3.4 角色按钮：显示当前活跃角色名或默认 User 图标

## 4. ModeToggle 组件

- [x] 4.1 创建 `src/features/reader/components/ModeToggle.tsx`，使用 BookOpen 和 MessageCircle 图标
- [x] 4.2 高亮当前模式按钮，非当前模式按钮为 ghost 样式
- [x] 4.3 点击切换调用 `store.toggleMode()`

## 5. ReaderPage 重构

- [x] 5.1 重构 `src/features/reader/ReaderPage.tsx`：引入 useReader hook、ReaderHeader、EpubViewer、ChatInterface
- [x] 5.2 使用 `AnimatePresence mode="wait"` 包裹阅读/对话视图，配置 opacity + y 平移动画（150ms duration）
- [x] 5.3 阅读模式渲染 EpubViewer，对话模式渲染 ChatInterface

## 6. 验证

- [x] 6.1 `npx tsc --noEmit` 编译通过
- [x] 6.2 确认 react-reader 和 framer-motion 依赖已安装
