# reader-md-txt-minimal-llm-ui — Proposal

## Why

当前点击书籍后 .txt 与 .epub 均无法打开，导致后续功能无法测试；阅读链路强依赖 EPUB 与 react-reader，复杂且易坏。同时 LLM 配置区选项过多、区分 Provider 增加维护成本，首页 GitHub 图标对核心流程无必要。本变更通过「宪法清理 + 阅读格式收缩 + 配置极简 + UI 收口」恢复「能打开文件」的最小可行路径，并降低配置与界面噪音。

## What Changes

- **宪法 (copilot-instructions.md)**：清理所有「EPUB / react-reader / epub.js / CFI」的强制约定；将电子书格式限定为 **仅 .md 与 .txt**；书籍渲染改为「文本 / Markdown 渲染」；索引与定位改为基于文本/段落（不再依赖 CFI）；Empty state 等文案从「EPUB」改为「.md / .txt」。
- **阅读器**：**BREAKING** 移除 EPUB 支持。书架仅展示并打开 .md / .txt；阅读器改为纯文本或 Markdown 渲染组件，不再使用 react-reader；依赖中移除 `react-reader`（及 epub.js 若为直接依赖）。
- **LLM 配置区**：仅保留最小可行配置 **Base URL + API Key + Model**；去除其他配置项（如 Temperature、MaxTokens、Provider 选择等）；**不区分 Provider**，统一为「OpenAI 兼容」单一入口。
- **首页 / 书架页**：移除 GitHub 图标（TopBar 或首页的 GitHub 入口）。

## Capabilities

### New Capabilities

- `text-viewer`: 文本与 Markdown 阅读器。支持 .md / .txt 文件通过 MCP readFile 获取文本后渲染；阅读进度可为段落/偏移；不依赖 react-reader。

### Modified Capabilities

- `epub-viewer`: 由「EPUB 渲染」改为被 `text-viewer` 替代或明确废弃；本变更内以 delta 说明「仅支持 .md/.txt，不再支持 EPUB」。
- `bookshelf-hook`: 书架挂载与列表过滤由「.epub」改为「.md / .txt」；Book 转换规则适配 .md/.txt 文件名。
- `bookshelf-ui`: Empty state 等文案从「EPUB」改为「.md / .txt」；移除首页/书架页的 GitHub 图标。
- `settings-page`: LLM 配置仅保留 Base URL、API Key、Model 三项；移除 Provider 选择及其余配置项。

## Impact

- **宪法**：.github/copilot-instructions.md 多处修订（技术栈、4.1/4.2、5.x/6.x、8.x 任务表、类型与术语）。
- **代码**：`src/features/reader`（EpubViewer → 文本/Markdown 查看器）、`useReader` 与 `ReaderPage`；`src/features/bookshelf`（useBookshelf 过滤、bookFileToBook）；`src/features/settings`（表单与状态）；TopBar/BookshelfPage 移除 GitHub 入口；类型 `BookFile.type` 移除 `epub`，增加 `md`；RAG/引用若保留则用段落或简化定位。
- **依赖**：移除 `react-reader`（及 epub.js 若单独列出）。
- **OpenSpec**：epub-viewer 的 delta；bookshelf-hook / bookshelf-ui / settings-page 的 delta。
