# EPUB 阅读器规范 — Delta（仅支持 .md/.txt，不再支持 EPUB）

## REMOVED Requirements

### Requirement: EPUB 文件加载
**Reason:** 阅读格式收缩为仅 .md 与 .txt；EPUB 与 react-reader 已移除。
**Migration:** 使用 text-viewer 能力；通过 MCP readFile 获取文本内容，由文本/Markdown 查看器渲染。

### Requirement: EPUB 渲染
**Reason:** 不再使用 react-reader 或 epub.js；由 text-viewer 替代。
**Migration:** 使用 specs/text-viewer 中的「文本与 Markdown 渲染」需求。

### Requirement: 阅读进度持久化（CFI）
**Reason:** 定位改为基于段落/偏移，不再使用 CFI。
**Migration:** 使用 text-viewer 的「阅读进度持久化（段落/偏移）」；旧 CFI 进度可忽略或一次性迁移为段落索引（若实现迁移）。

### Requirement: CFI 跳转
**Reason:** CFI 为 EPUB 概念，已废弃。
**Migration:** 使用 text-viewer 的「引用跳转」；定位方式为段落或偏移。
