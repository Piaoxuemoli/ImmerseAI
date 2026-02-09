## Why

ReaderPage 当前仅包含占位 UI（"EPUB viewer coming soon"）和已实现的 ChatInterface。用户无法阅读 EPUB 书籍，也无法在阅读模式和对话模式之间切换。EPUB 渲染是 Phase 4 的核心前置，角色对话、引用跳转、笔记功能均依赖阅读器组件就位。

## What Changes

- 新增 `EpubViewer` 组件：使用 react-reader 渲染 EPUB，通过 IPC 调用 MCP `readFile` 获取 ArrayBuffer，支持 `goToCfi(cfi)` 跳转
- 新增 `ReaderHeader` 组件：返回按钮 + 书名 + 角色选择按钮 + 模式切换按钮
- 新增 `ModeToggle` 组件：📖阅读 ⇄ 💬对话 模式切换，使用 framer-motion 过渡动画
- 阅读进度持久化：CFI 存入 Zustand Store 和 Book.lastReadCfi
- 重构 `ReaderPage.tsx`：整合 ReaderHeader + EpubViewer + ChatInterface，使用 `AnimatePresence` 切换两种模式
- 新增 `useReader` hook：封装 EPUB 加载、CFI 管理、goToCfi 暴露

## Capabilities

### New Capabilities
- `epub-viewer`: EPUB 渲染组件，react-reader 集成，CFI 进度管理，goToCfi 跳转
- `reader-header`: 阅读页顶栏，返回导航 + 书名 + 角色选择 + 模式切换

### Modified Capabilities
- `react-infrastructure`: ReaderPage 从占位 UI 重构为完整的 EPUB 阅读 + 对话双模式页面

## Impact

- 文件新增：`EpubViewer.tsx`, `ReaderHeader.tsx`, `ModeToggle.tsx`, `useReader.ts`
- 文件修改：`ReaderPage.tsx`
- 依赖：`react-reader`（已在 package.json）, `epubjs`（react-reader peer dep）, `framer-motion`
- 数据流：Renderer → IPC `mcp:read-file` → Main/MCP → EPUB ArrayBuffer → react-reader
