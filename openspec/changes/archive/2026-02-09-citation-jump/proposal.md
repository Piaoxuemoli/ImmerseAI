## Why

对话界面中 LLM 返回的消息包含 `citations` 数组（来自 RAG 检索），但当前 `CitationBadge` 组件的 `onClick` 未被接入，点击引用无任何反应。用户无法从对话中快速定位引用原文在 EPUB 中的位置，割裂了"对话—阅读"的沉浸体验闭环。这是宪法 Phase 5 任务 5.1 定义的关键整合功能。

## What Changes

- 在 `ChatInterface` → `MessageBubble` → `CitationBadge` 组件链路中打通 `onCitationClick` 回调
- 点击 `CitationBadge` 时：切换 `readerMode` 为 `'read'`，调用 `goToCfi(citation.cfi)` 跳转到 EPUB 原文位置
- 利用 epubjs Highlights API 对跳转目标文本进行视觉高亮
- 利用 Zustand Store 中已有的 `setReaderMode` + `setCurrentCfi` 作为 chat → reader 的桥接
- `useReader` hook 监听 `currentCfi` 变化并触发 `rendition.display(cfi)`
- `AnimatePresence` + `framer-motion` 确保 chat → read 过渡平滑
- 返回对话模式时保持聊天上下文（`currentSession` 已持久化在 Zustand Store 中）

## Capabilities

### New Capabilities
- `citation-jump`: 对话引用跳转到阅读器原文，包括回调链路、CFI 跳转、文本高亮、模式平滑切换

### Modified Capabilities
- `chat-interface`: MessageBubble 增加 `onCitationClick` prop，ChatInterface 注入跳转回调
- `epub-viewer`: EpubViewer 增加引用文本高亮能力（epubjs annotations API）
- `global-store`: ImmerseStore 新增 `pendingCitationCfi` 字段用于 chat→reader 跳转信号传递

## Impact

- **组件改动**: `ChatInterface.tsx`, `MessageBubble.tsx`, `CitationBadge.tsx`（已有 onClick prop，需传入）, `ReaderPage.tsx`, `EpubViewer.tsx`
- **Hook 改动**: `useReader.ts`（增加 `currentCfi` 监听 + 高亮逻辑）
- **Store 改动**: `ImmerseStore` 接口 + Zustand 实现（新增 `pendingCitationCfi` + `setPendingCitationCfi`）
- **类型改动**: `src/shared/types/index.ts`（ImmerseStore 接口扩展）
- **无新依赖**: 所有技术（epubjs annotations、framer-motion AnimatePresence）已在项目中
