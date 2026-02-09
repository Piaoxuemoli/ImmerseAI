## Context

ReaderPage 当前包含一个占位 Header 和条件渲染的 ChatInterface。需要替换为真实的 EPUB 渲染器和完整的 Header + 模式切换系统。

已有基础设施：
- `window.electronAPI.mcp.readFile(path)` — IPC 获取文件 ArrayBuffer
- `useStore` — Zustand 中已有 `currentCfi`, `readerMode`, `toggleMode`, `setCurrentCfi`, `setReaderMode`
- `Book.lastReadCfi` — 类型已定义，可持久化阅读进度
- `docs/spikes/spike-react-reader.tsx` — 验证了 react-reader 的 location/locationChanged/getRendition/goToCfi 用法
- `ChatInterface` — 已完成的对话组件（Phase 4 chat-ui change）
- `framer-motion` — 已安装

## Goals / Non-Goals

**Goals:**
- 使用 react-reader 渲染通过 MCP 获取的 EPUB 文件
- 提供 ReaderHeader 导航栏（返回、书名、角色、模式切换）
- 实现阅读/对话模式的 AnimatePresence 平滑切换
- 持久化阅读进度到 Zustand Store（Book.lastReadCfi）
- 暴露 goToCfi 方法供外部（引用跳转）调用

**Non-Goals:**
- EPUB 解析提取章节文本（已在 rag-indexing ingest pipeline 中实现）
- 角色配置弹窗 UI（PersonaConfigDialog 属于后续 change）
- 引用跳转集成（CitationBadge 点击 → goToCfi，属于 Phase 5 整合）
- 自定义 EPUB 主题/字号设置（后续 change）
- PDF/TXT 格式支持

## Decisions

### D1: EPUB 数据源 — ArrayBuffer via Blob URL
**决定**：通过 IPC 调用 `mcp.readFile(book.path)` 获取 ArrayBuffer，转换为 `Blob URL` 传给 react-reader 的 `url` prop。

**理由**：react-reader 接受 URL 字符串作为 epub 源。由于 EPUB 文件通过 MCP Server 读取（非直接文件路径），需先获取 ArrayBuffer 再创建 Blob URL。spike 中验证了此方式可行。

**替代方案**：直接传文件路径 → react-reader 在渲染进程中无法直接访问文件系统（nodeIntegration: false），必须通过 IPC。

### D2: goToCfi 暴露方式 — useReader hook + useImperativeHandle
**决定**：创建 `useReader` hook 管理 `renditionRef`，通过 `useImperativeHandle` 将 `goToCfi` 方法暴露给父组件。ReaderPage 持有 ref 供未来引用跳转使用。

**理由**：goToCfi 需要从 ChatInterface 的 CitationBadge 触发，跨越组件边界。通过 ref 暴露是 React 标准模式，不引入额外状态管理复杂度。

**替代方案**：通过 Zustand 存储 targetCfi → EpubViewer useEffect 监听 → 增加状态同步复杂度，且可能触发不必要的 re-render。

### D3: 阅读进度持久化 — Zustand + Book.lastReadCfi
**决定**：locationChanged 回调中同时更新 `store.setCurrentCfi(cfi)` 和 `store.setBooks(updatedBooks)`（更新对应 Book 的 lastReadCfi）。Zustand persist middleware 自动写入 localStorage。

**理由**：Book 数据已通过 persist middleware 持久化。将 lastReadCfi 直接存入 Book 对象，重新打开时从 Book.lastReadCfi 恢复初始 location。无需额外存储机制。

### D4: 模式切换动画 — AnimatePresence + motion.div
**决定**：使用 framer-motion 的 `AnimatePresence` 包裹阅读/对话两个视图，`mode="wait"` 确保退出动画完成后再入场。动画使用 opacity + y 平移，150ms duration。

**理由**：已安装 framer-motion，符合项目宪法的动画方案选型。`mode="wait"` 避免两个视图同时存在导致布局闪烁。

### D5: ModeToggle 组件设计
**决定**：使用 lucide-react 的 `BookOpen` 和 `MessageCircle` 图标，Zustand `toggleMode` 切换。按钮使用 shadcn Button variant="ghost"。

**理由**：轻量，与 Header 其他按钮风格一致。

### D6: useReader hook 职责
**决定**：`useReader(bookId)` hook 负责：(1) 通过 IPC 加载 EPUB ArrayBuffer → Blob URL，(2) 管理 loading/error 状态，(3) 提供 location/setLocation，(4) renditionRef 管理，(5) goToCfi 方法。组件卸载时 revoke Blob URL。

**理由**：将 EPUB 加载逻辑和渲染状态集中在 hook 中，EpubViewer 保持纯展示组件。

## Risks / Trade-offs

- **[Blob URL 内存]** 大 EPUB 文件（>50MB）的 Blob URL 占用内存 → 组件卸载时 `URL.revokeObjectURL()` 释放。通常 EPUB < 10MB，风险可控。
- **[react-reader 类型]** react-reader 的 TypeScript 类型不完善，部分 prop 需 `as` 断言 → 通过 `Rendition` 类型从 epubjs 导入缓解。
- **[首次加载延迟]** IPC 读取大 EPUB 可能需 200-500ms → 显示 loading 状态，用户有视觉反馈。
- **[模式切换时状态丢失]** 切换到 chat 模式时 EpubViewer 卸载，切回时需重新渲染 → AnimatePresence 会完全卸载/重挂载，但 location 从 Zustand 恢复，无进度丢失。
