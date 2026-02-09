## Context

RAG Worker（`src/workers/rag.worker.ts`）已实现完整的 ingest pipeline（切分→向量化→Orama 存储→IndexedDB 持久化）和 status 查询。`search` 消息处理当前为 `reply({ type: 'error', message: 'search not implemented' })` 占位。

Worker 内已有的可复用基础设施：
- `embed(texts)` — 单例 Transformers.js pipeline，返回 `number[][]`
- `bookIndexes: Map<string, OramaDB>` — 内存中的 per-book Orama 实例
- `restoreBookIndex(bookId)` — 从 IndexedDB 恢复索引到内存 Map
- `existsInIndexedDB(key)` — 检查 IndexedDB 中是否存在持久化索引
- Orama 的 `search()` API 支持 `mode: 'vector'` 向量检索

## Goals / Non-Goals

**Goals:**
- 实现 search 消息的完整处理，将 query 向量化并执行 Orama 向量相似度检索
- 索引自动恢复：内存中不存在时自动尝试从 IndexedDB 恢复，对调用方透明
- 返回标准 `SearchResult[]`（text, cfi, chapter, score）
- 未索引书籍返回友好错误消息

**Non-Goals:**
- 全文/关键词检索（仅向量语义检索）
- 多书跨库联合检索
- 检索结果重排序（reranking）
- 相似度阈值过滤（由调用方决定是否过滤）

## Decisions

### D1: 索引自动恢复策略
**决定**：search 时先查内存 Map → 不存在则 `restoreBookIndex()` → 仍失败则返回错误。

**理由**：复用已有的 `restoreBookIndex()` 函数，status 消息已使用相同的"内存优先 + IndexedDB 回退"模式。对调用方完全透明，无需先手动 status 再 search。

**替代方案**：要求调用方先发 status 检查 → 增加一次往返通信，且调用方需处理时序问题，不如在 search 内部统一处理。

### D2: query 向量化复用 embed()
**决定**：直接调用 `embed([query])` 获取 query 向量，取 `result[0]` 作为搜索向量。

**理由**：`embed()` 内部已是单例模型，无需重复加载。单条文本作为长度 1 的数组传入即可。

### D3: Orama search 配置
**决定**：使用 `search(db, { mode: 'vector', vector: { value, property: 'embedding' }, limit: topK })`，不设 `similarity` 阈值。

**理由**：spike-orama-vector.ts 验证了该 API 可用。不设阈值是因为 topK 已限制结果数量，阈值过滤留给上层业务逻辑（如 chat 模块）决定。

### D4: score 映射
**决定**：直接使用 Orama 返回的 `hit.score` 作为 `SearchResult.score`。

**理由**：Orama 向量搜索返回的 score 已是 0-1 范围的余弦相似度，与 `SearchResult` 接口定义一致，无需转换。

### D5: 错误消息本地化
**决定**：未索引错误使用中文消息 `"该书籍尚未建立索引，请先打开书籍完成索引"`。

**理由**：项目面向中文用户，错误消息直接展示在 UI 中，中文体验更好。

## Risks / Trade-offs

- **[单条 embed 性能]** query 向量化需约 10-50ms → 可接受，远低于 200ms 目标。性能瓶颈在首次模型加载，后续调用极快。
- **[IndexedDB 恢复延迟]** 大索引恢复可能需 100-300ms → 仅首次 search 触发，之后常驻内存。满足 < 500ms 规格要求。
- **[内存占用]** 多本书索引同时常驻内存 → 当前阶段用户书库规模有限，暂不做 LRU 驱逐，后续可优化。
