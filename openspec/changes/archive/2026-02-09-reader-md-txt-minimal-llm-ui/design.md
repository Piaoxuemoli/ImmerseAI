# reader-md-txt-minimal-llm-ui — Design

## Context

当前阅读链路依赖 EPUB 与 react-reader，.txt/.md 无法打开；LLM 配置区选项过多且按 Provider 区分；首页有 GitHub 图标。本变更将阅读格式收缩为仅 .md/.txt，用纯文本/Markdown 渲染替代 EPUB，宪法与代码同步清理 EPUB 相关约定，并将 LLM 配置与 UI 收口为最小可行。

**当前状态**：Reader 使用 EpubViewer + react-reader；书架过滤与类型含 `.epub`；设置页有 Base URL、API Key、Model 及 Temperature/MaxTokens/Provider 等；TopBar/Bookshelf 含 GitHub 入口。

**约束**：不引入新大型依赖；定位/进度用段落或偏移，不依赖 CFI；MCP 已支持 readFile，可据此取书内容。

## Goals / Non-Goals

**Goals:**
- 书架仅展示并打开 .md / .txt，点击后能稳定打开并渲染。
- 阅读器为文本/Markdown 组件，不依赖 react-reader；进度以段落或偏移表示。
- 宪法中移除 EPUB/react-reader/CFI 强制约定，术语统一为 .md/.txt。
- LLM 配置仅保留 Base URL、API Key、Model，不区分 Provider。
- 移除首页/书架页的 GitHub 图标。

**Non-Goals:**
- 不保留 EPUB 兼容模式；不实现 CFI 或 epub.js 相关逻辑。
- 不在此变更内扩展 RAG/引用格式（仅做必要简化以适配段落/偏移）。

## Decisions

1. **阅读器实现**  
   - **选择**：用单一「文本/Markdown 查看器」组件替代 EpubViewer；.txt 按纯文本渲染，.md 用轻量 Markdown 渲染（如已有 react-markdown 或等价库）。  
   - **理由**：去掉 react-reader 与 epub.js，降低复杂度且与「仅 .md/.txt」一致。  
   - **备选**：保留 react-reader 仅处理 .md——否决，因 react-reader 面向 EPUB，语义与依赖均不匹配。

2. **内容获取与路由**  
   - **选择**：继续通过现有 MCP readFile（或等价能力）按路径取书内容；Reader 路由/入参不变，仅内部由 EpubViewer 换成 text-viewer。  
   - **理由**：与 proposal 中「MCP readFile 获取文本」一致，改动集中在 reader 模块。  
   - **备选**：新增专用 MCP 方法——否决，readFile 已足够。

3. **进度与定位**  
   - **选择**：进度存储为「段落索引或字符偏移」；不实现 CFI。RAG/引用若仍存在则用段落或简化定位（如 paragraphIndex + offset）。  
   - **理由**：与宪法「索引与定位改为基于文本/段落」一致，实现简单。  
   - **备选**：保留 CFI 仅用于 .md——否决，CFI 为 EPUB 概念，不再引入。

4. **类型与书架过滤**  
   - **选择**：`BookFile.type` 移除 `epub`，增加 `md`（及已有 `txt`）；bookshelf 过滤与 `bookFileToBook` 仅处理 .md/.txt。  
   - **理由**：类型与 UI 一致，避免遗留 epub 分支。  
   - **备选**：保留 epub 类型但隐藏——否决，易造成后续误用。

5. **LLM 配置**  
   - **选择**：设置页仅保留 Base URL、API Key、Model 三项；移除 Temperature、MaxTokens、Provider 选择等；后端/调用处统一为「OpenAI 兼容」单一入口。  
   - **理由**：最小可行配置，降低维护与用户认知负担。  
   - **备选**：保留 Provider 选择但隐藏高级选项——否决，与「不区分 Provider」不符。

6. **GitHub 图标**  
   - **选择**：从 TopBar 与 Bookshelf 页（或首页）移除 GitHub 图标/链接，不保留开关。  
   - **理由**：与 proposal「移除 GitHub 图标」一致，简化 UI。

## Risks / Trade-offs

- **[Risk] 已有 .epub 书籍无法再打开** → Mitigation：在宪法与 UI 文案中明确「仅支持 .md / .txt」；Empty state 引导用户使用正确格式。
- **[Risk] 进度格式变更导致旧进度失效** → Mitigation：若此前进度为 CFI，可视为不兼容；新进度仅用段落/偏移，必要时在代码中做一次迁移或忽略旧字段。
- **[Risk] 移除 LLM 高级选项影响高级用户** → Mitigation：接受为 trade-off；若未来需要可再以可选「高级」折叠恢复少量选项。

## Migration Plan

1. **宪法**：按变更点修订 `.github/copilot-instructions.md`（技术栈、4.1/4.2、5.x/6.x、8.x、类型与术语），全文替换 EPUB/CFI 相关表述为 .md/.txt 与段落/偏移。
2. **类型与数据**：更新 `BookFile` 等类型（移除 epub，增加 md）；若有持久化进度格式，决定是否迁移或重置。
3. **阅读器**：实现 text-viewer 组件与 useReader/ReaderPage 集成；移除 EpubViewer 与 react-reader 使用；从依赖中移除 react-reader（及 epub.js 若单独列出）。
4. **书架**：bookshelf 过滤与 Book 转换仅 .md/.txt；Empty state 等文案替换。
5. **设置**：设置页表单与状态仅保留 Base URL、API Key、Model；调用方统一为 OpenAI 兼容入口。
6. **UI 收口**：移除 TopBar/Bookshelf 的 GitHub 图标。
7. **OpenSpec**：更新/新增 specs（text-viewer 新 spec；epub-viewer、bookshelf-hook、bookshelf-ui、settings-page 的 delta）。
8. **回滚**：若需回滚，恢复 EpubViewer 与 react-reader 依赖及宪法中 EPUB 段落；本变更无数据库 schema 变更，回滚以代码与宪法还原为主。

## Open Questions

- RAG/引用当前若依赖 CFI 或 epub 定位，具体调用点与数据格式待实现时确认，以便用段落/偏移替代或暂时简化。
