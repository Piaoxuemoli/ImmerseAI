## Why

RAG Worker 的 `search` 消息处理当前为 `"search not implemented"` 占位。索引管道（ingest）已完成，但用户无法执行语义检索，导致对话模块（chat-ui）无法获取书籍上下文，角色扮演和引用跳转功能均被阻塞。实现 search 是打通"索引→检索→对话"完整链路的关键一步。

## What Changes

- 在 `rag.worker.ts` 中实现 `search` 消息的完整处理逻辑，替换当前的 error 占位
- 接收 `query` 字符串 + `bookId` + `topK`（默认 5），调用 Transformers.js 向量化 query，再通过 Orama 执行向量相似度检索
- 返回 `SearchResult[]`（text, cfi, chapter, score）
- 处理未索引书籍的友好错误：先检查内存 Map，若不存在则尝试从 IndexedDB 恢复，仍不存在则返回错误
- 支持从 IndexedDB 恢复索引后直接执行检索（无需重新 ingest）

## Capabilities

### New Capabilities
- `rag-search`: 语义检索的完整实现，包括 query 向量化、Orama 向量搜索、索引自动恢复和错误处理

### Modified Capabilities
- `rag-worker`: search 消息处理从 placeholder 变为完整实现（行为变更）

## Impact

- **代码**：`src/workers/rag.worker.ts` — search case 分支重写
- **依赖**：复用已有的 `embed()` 函数和 Orama `search` API，无新依赖
- **下游**：解锁 chat 模块的 RAG 上下文注入、persona-generator 的多维度检索、citation-jump 的引用定位
