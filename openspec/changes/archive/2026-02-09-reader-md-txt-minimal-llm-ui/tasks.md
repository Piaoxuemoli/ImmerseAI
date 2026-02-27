## 1. 宪法与类型

- [x] 1.1 修订 .github/copilot-instructions.md：清理 EPUB/react-reader/CFI 强制约定，电子书格式限定为仅 .md 与 .txt，书籍渲染与索引/定位改为文本/段落表述，Empty state 等文案改为 .md/.txt
- [x] 1.2 更新 BookFile 等类型：移除 epub，增加 md；Book 进度字段若为 CFI 则改为段落/偏移或兼容字段
- [x] 1.3 若有全局 store 或类型中的 lastReadCfi/pendingCitationCfi，改为段落/偏移或等价字段（与 text-viewer spec 一致）

## 2. 文本/Markdown 阅读器

- [x] 2.1 实现 text-viewer 组件：.txt 纯文本渲染，.md 使用 Markdown 渲染（如 react-markdown），样式与 Notion 极简一致
- [x] 2.2 修改 useReader：通过 mcp.readFile(book.path) 获取文本内容（UTF-8），交给 text-viewer；移除 Blob URL 与 react-reader 逻辑
- [x] 2.3 ReaderPage 使用 text-viewer 替代 EpubViewer；阅读进度以段落索引或偏移持久化与恢复
- [x] 2.4 实现引用跳转：goToParagraph(index) 或等价，可选高亮；若存在 pendingCitation 信号则适配段落/偏移
- [x] 2.5 移除 EpubViewer 组件及所有 react-reader 引用；从 package.json 移除 react-reader（及 epub.js 若单独列出）

## 3. 书架

- [x] 3.1 useBookshelf：listFiles 后过滤 .md 与 .txt（不再过滤 .epub）；Book 转换规则适配 .md/.txt 文件名与 type
- [x] 3.2 BookshelfPage Empty state 文案改为「添加 .md / .txt 文件」或等价引导
- [x] 3.3 TopBar 移除 GitHub 图标与点击逻辑，仅保留 Settings、Import

## 4. 设置页 LLM 配置

- [x] 4.1 设置页 LLM 区仅保留 Base URL、API Key、Model 三项输入；移除 Provider 下拉、Temperature、MaxTokens 滑块
- [x] 4.2 Store 与调用方：llmConfig 仅保留 baseUrl、model（及 apiKey 仍走 safeStorage）；后端调用统一 OpenAI 兼容入口，不使用 provider 分支
- [x] 4.3 测试连接按钮仍使用当前 baseUrl + apiKey + model 发送测试请求

## 5. 验证与收尾

- [x] 5.1 书架仅展示 .md/.txt，点击书籍能打开并渲染；.txt/.md 内容与进度恢复正确
- [x] 5.2 设置页仅显示 Base URL、API Key、Model；测试连接可用
- [x] 5.3 全书搜索/引用若依赖 CFI，改为段落/偏移或暂时简化并验证无报错
