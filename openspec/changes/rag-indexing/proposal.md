## Why

`rag.worker.ts` 的 `ingest` 和 `status` 处理目前是 placeholder（返回 error / 始终 false）。要实现宪法第四章定义的 Ingestion Pipeline（切分 → 向量化 → 存储 → 持久化），必须集成 Orama 向量数据库和 LangChain 文本切分器，将 ingest 从占位符升级为完整实现。这是让阅读器能真正"理解"书籍内容的关键步骤。

## What Changes

- **实现 `ingest` 消息处理**：接收 `Chapter[]`，经 RecursiveCharacterTextSplitter(500, 50) 切分，batch=32 向量化，存入 Orama
- **实现 `status` 真实返回**：检查 bookId 对应的 Orama 索引是否存在于内存或 IndexedDB
- **集成 Orama 向量数据库**：在 Worker 内管理 per-book 的 Orama 实例（schema: text, embedding[384], cfi, chapter）
- **集成 IndexedDB 持久化**：使用 `@orama/plugin-data-persistence` 的 `persist` / `restore` 实现索引缓存
- **进度上报**：每完成约 10% 的 chunk 处理，通过 `postMessage` 发送 `ingest:progress` 消息
- **新增依赖**：`@orama/orama`、`@orama/plugin-data-persistence`、`langchain`（仅 `text_splitter` 模块）

## Capabilities

### New Capabilities
- `rag-indexing`: 覆盖 Orama 索引创建、文本切分、批量向量化、进度上报、IndexedDB 持久化、索引缓存恢复的完整 ingest 实现

### Modified Capabilities
- `rag-worker`: Worker 消息分发中 `ingest` case 从 placeholder 升级为真实实现；`status` case 从硬编码 false 升级为动态检查索引存在性

## Impact

- **修改文件**：`src/workers/rag.worker.ts`（ingest/status 实现）、`src/workers/rag-types.ts`（可能需要补充内部类型）
- **新增依赖**：`@orama/orama`、`@orama/plugin-data-persistence`、`langchain`
- **运行环境**：所有新代码在 Web Worker 中执行，不影响渲染进程帧率（P-2 合规）
- **存储**：IndexedDB 新增 per-book 持久化数据（key: `book_{bookId}`）
- **内存**：batch=32 限制单次向量化内存，避免大书导致 OOM
