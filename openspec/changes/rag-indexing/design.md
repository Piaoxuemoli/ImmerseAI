## Context

`rag.worker.ts` 已有 embedding 模型单例、消息分发骨架和 `embed()` 函数。`ingest` 和 `status` 目前是 placeholder。Orama spike (`docs/spikes/spike-orama-vector.ts`) 验证了 `create → insert → search → persist → restore` 全流程可在 JS 运行时工作。现在需要在 Worker 内部将这些拼接为完整的 ingest pipeline。

## Goals / Non-Goals

**Goals:**
- 实现 `ingest` 消息处理：chapters → 切分 → 批量向量化 → Orama 存储 → IndexedDB 持久化
- 实现 `status` 真实检查：内存 Map → IndexedDB 探测
- 每 ~10% 上报 `ingest:progress`
- 已索引书籍重启后从 IndexedDB 秒级恢复

**Non-Goals:**
- 不实现 `search` — 留待下一个 change
- 不处理 EPUB 解析（渲染进程负责提取 `Chapter[]` 后传入）
- 不实现增量索引（同一 bookId 重复 ingest 会覆盖旧索引）
- 不做 IndexedDB 存储容量管理或 LRU 淘汰

## Decisions

### D1: Per-book Orama 实例 Map

**选择**：Worker 内维护 `Map<string, Orama>` 将每本书的索引隔离在独立 Orama 实例中。

**替代方案**：单一 Orama 实例 + bookId 字段过滤。

**理由**：per-book 隔离使 persist/restore 粒度与 `book_{bookId}` key 天然对齐；单一实例在大量书籍时向量搜索需额外过滤，性能更差。spike 也验证了多实例无初始化开销。

### D2: LangChain RecursiveCharacterTextSplitter

**选择**：使用 `langchain/text_splitter` 的 `RecursiveCharacterTextSplitter`（chunkSize: 500, chunkOverlap: 50, separators: `["\n\n", "\n", "。", " "]`）。

**替代方案**：手写正则切分器。

**理由**：宪法明确指定使用 LangChain RecursiveCharacterTextSplitter；该 splitter 对中文段落边界（`\n\n`、`。`）有良好处理；仅引入 `langchain/text_splitter` 子路径避免打包整个 langchain。

### D3: 批量向量化 batch=32

**选择**：将所有 chunks 按 32 个一组送入 `embed()`，每组完成后再处理下一组。

**替代方案**：逐条向量化 / 一次性全量。

**理由**：逐条有大量 overhead（模型调用次数高）；全量对 10000+ chunks 的大书会导致内存溢出。batch=32 是 Transformers.js 推荐的平衡点。进度上报也基于 batch 完成数计算。

### D4: 进度计算方式

**选择**：基于已处理 chunk 数 / 总 chunk 数。切分完成后总数已知，每完成一个 batch 计算 `Math.floor((processed / total) * 100)`，当百分比相比上次上报值变化 ≥ 10 时发送 `ingest:progress`。

**替代方案**：基于章节数。

**理由**：章节大小差异大（有的章节 500 字，有的 5 万字），chunk 粒度更均匀，进度条更平滑。

### D5: IndexedDB 持久化策略

**选择**：ingest 完成后调用 `persist(db, 'json')` 获得序列化字符串，通过 `indexedDB` 原生 API 存入 key=`book_{bookId}`。restore 时从 IndexedDB 读取字符串后调用 `restore('json', data)`。

**替代方案**：使用 `persist(db, 'binary')` 存二进制。

**理由**：spike 验证了 `'json'` 格式可正常 persist/restore；`'json'` 便于调试和检查；binary 格式节省约 30% 空间但牺牲可调试性，可作为未来优化。IndexedDB 操作封装为独立的 `saveToIndexedDB` / `loadFromIndexedDB` / `existsInIndexedDB` 辅助函数，方便测试和替换。

### D6: status 检查策略

**选择**：两级检查 — 先查内存 Map 中是否有该 bookId 的 Orama 实例，再查 IndexedDB 中是否有 `book_{bookId}` key。任一存在即返回 `isIndexed: true`。

**替代方案**：只检查内存。

**理由**：用户重启应用后内存 Map 为空，但 IndexedDB 中的持久化索引仍有效。status 需反映"可快速恢复"的状态，而非仅"已在内存中"。

### D7: Chunk 元数据继承

**选择**：每个 chunk 继承其所属 chapter 的 `title` 和 `cfi`。Orama schema 中 `chapter` 存 title，`cfi` 存章节级 CFI。

**替代方案**：计算子 CFI 精确到段落。

**理由**：子 CFI 计算需要完整 EPUB DOM 结构信息（Worker 中不可用）。章节级 CFI 已足够将用户导航到正确章节，后续可通过文本搜索在章节内精确定位。

## Risks / Trade-offs

- **[大书内存压力]** 10 万字书籍约产生 200+ chunks × 384-dim 向量。→ 缓解：batch=32 限制峰值内存；Orama 内部使用 TypedArray 而非普通数组。
- **[IndexedDB 容量]** 大书的 JSON 序列化索引可能达 10-50 MB。→ 缓解：当前阶段不限制；未来可切换 binary 格式或添加 LRU 淘汰。
- **[langchain 打包体积]** 即使仅引入 `text_splitter`，tree-shaking 效果取决于 bundler。→ 缓解：使用 `langchain/text_splitter` 子路径导入；Worker 独立打包不影响主 bundle。
- **[IndexedDB 在 Worker 中的兼容性]** 大部分浏览器支持 Worker 中使用 IndexedDB，但 Electron 中需要确认。→ 缓解：spike 阶段优先验证；若出问题可回退到通过 IPC 存储。
- **[重复 ingest 覆盖]** 同一 bookId 二次 ingest 会丢弃旧索引。→ 当前可接受，未来可增加版本校验。
