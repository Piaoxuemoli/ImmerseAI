## Context

RAG 引擎已迁移至 Electron 主进程（`rag-handler.ts`），通过 IPC 与渲染进程通信。缓存使用 `userData/rag-cache/{contentHash}.json` 文件存储，格式版本为 v2。当前固定 CHUNK_SIZE=500、BATCH_SIZE=32，对所有书籍采用相同策略。

问题：`凡人修仙传.txt` 等超长网文产生 177k+ chunks，全量语义 embedding 需 20-30 分钟，在此期间 `book.contentHash` 未设置，人格生成功能抛出 `BOOK_NOT_INDEXED`。

## Goals / Non-Goals

**Goals:**
- 任何大小的书籍打开后 <2s 即可开始人格对话（词法质量）
- 后台语义升级有独立进度条，用户可感知质量提升过程
- 超大书（>5000 chunks）通过采样+混合检索保持可接受的语义质量
- CHUNK_SIZE 自动适配书籍规模，避免过细切片

**Non-Goals:**
- 不支持跨书检索
- 不优化首次打开中等书籍（<5000 chunks）的速度，该路径已足够快
- 不做 embedding 的增量更新（内容变化时全量重索引）
- 不在后台升级期间保证实时的语义准确度（词法兜底）

## Decisions

### Decision 1：自适应 CHUNK_SIZE 公式（分段非线性）

**选型**：分段函数，而非纯线性。

```
totalChars < 200,000           → CHUNK_SIZE = 500   (短文/短篇)
200,000 ≤ chars < 2,000,000    → CHUNK_SIZE = 1,000 (中长篇)
2,000,000 ≤ chars < 10,000,000 → CHUNK_SIZE = 2,000 (长篇小说)
chars ≥ 10,000,000             → CHUNK_SIZE = 4,000 (超长网文)
上限 clamp: 8,000
```

CHUNK_OVERLAP 同步等比扩展（overlap = CHUNK_SIZE × 0.1，最小 50）。

**为何不用纯线性**：纯线性在边界处无自然对齐；分段函数对应书籍的自然分类（短文/小说/网文），每类内部 CHUNK_SIZE 固定，行为可预测，便于测试。

**为何不按 chunk 数反推**：书籍字数在加载 content 后即可得，无需先切片再判断，避免两次遍历。

---

### Decision 2：大书阈值与语义采样策略

**阈值**：`SEMANTIC_FULL_THRESHOLD = 5,000 chunks`

低于阈值 → 全量 semantic（当前逻辑，不变）  
超过阈值 → 两阶段：立即词法 + 后台语义采样升级

**采样策略**（目标：总采样量 ≤ `MAX_SEMANTIC_CHUNKS = 10,000`）：

```
headCount = min(2000, totalChunks × 0.15)  // 书头，人物/世界观
tailCount = min(2000, totalChunks × 0.15)  // 书尾，结局
midTarget = MAX_SEMANTIC_CHUNKS - headCount - tailCount
midChunks = chunks[headCount .. totalChunks-tailCount]
step      = max(1, floor(midChunks.length / midTarget))
sampled   = head + midChunks[每step个取1] + tail   // 去重
```

未被采样的 chunk 保留文本（供词法搜索），embedding 字段为 `undefined`。

**为何保留未采样 chunk 的文本**：混合检索依赖词法引擎对全量文本建索引，删除文本会导致覆盖缺失。

---

### Decision 3：两阶段 IPC 事件设计

```
阶段 1（立即，<1s）:
  rag:ingest-progress { bookId, progress: 100 }
  rag:ingest-complete { bookId, contentHash, chunkCount, mode: 'lexical' }

阶段 2（后台，异步）:
  rag:upgrade-progress { bookId, progress: 0..100 }   // 新增
  rag:upgrade-complete { bookId, chunkCount }          // 新增（更新采样 chunkCount）
```

`rag:ingest-complete` 携带 `mode` 字段，渲染层据此决定是否显示升级进度条。  
`rag:upgrade-progress` 与 `rag:ingest-progress` 使用不同事件名，避免进度条复用造成的视觉跳变（前者消失后者出现）。

**为何不复用 ingest-progress**：之前的"先 complete 再 progress"混用方案在 UI 层造成进度条闪烁消失再出现，体验差。

---

### Decision 4：混合检索 RRF 实现

仅当 `cache.mode === 'hybrid'` 时启用，其他模式保持现有逻辑。

```
semanticResults = cosineSearch(queryEmbedding, sampledChunks, topK×2)
lexicalResults  = oramaSearch(query, allChunks, topK×2)

// Reciprocal Rank Fusion
k = 60
for each doc in union(semantic, lexical):
  rankS = semanticResults.indexOf(doc) + 1  // Infinity if absent
  rankL = lexicalResults.indexOf(doc)  + 1
  score = 1/(k + rankS) + 1/(k + rankL)

final = topK docs sorted by RRF score descending
```

**为何 topK×2 作为双路召回数**：RRF 融合需要足够候选集才能有效重排；扩大召回后截取 topK，确保最终质量不降于单路。

---

### Decision 5：缓存版本升级至 v3，强制清除

`CACHE_VERSION` 从 2 升至 3。`loadCache` 读取时检查版本，不匹配时返回 `null` 并删除旧文件。

新缓存 `mode` 字段增加 `'hybrid'` 枚举值。`CacheFile` 结构中 `chunks[].embedding` 改为可选（未采样的 chunk 此字段缺失）。

## Risks / Trade-offs

**[风险] 超大书后台升级内存占用高**  
→ 177k chunks × 文本 ≈ 88MB + 10k 采样 embeddings ≈ 15MB，总体可接受。  
→ 后台升级在独立 async 函数中运行，GC 在函数返回后可回收 chunks 数组。

**[风险] 后台升级期间用户关闭应用，升级丢失**  
→ 下次打开书时重新触发后台升级（词法缓存仍有效，不影响基础功能）。  
→ 不做持久化的"升级进行中"标记，保持简单。

**[风险] RRF 参数 k=60 未经调优**  
→ k=60 是学术文献推荐的默认值，对中文网文未验证。  
→ 作为可配置常量 `RRF_K`，后续可调整。

**[风险] 采样策略对以"番外/后记"结尾的书覆盖不完整**  
→ tailCount=2000 已足以覆盖结尾重要章节，可接受。

## Migration Plan

1. 升级 `CACHE_VERSION = 3`：旧缓存读取时自动失效并删除
2. 添加 `adaptiveChunkSize(totalChars)` 函数
3. 拆分 `ragIngest` 为两阶段（立即词法 + background upgrade）
4. 实现 `backgroundReindexSemantic` 中的采样逻辑（替换当前全量版本）
5. 实现 `hybridSearch` 函数（RRF 融合）
6. 更新 `ragSearch` 路由逻辑（按 cache.mode 分发）
7. preload / types 增加 upgrade 事件
8. `useRag` hook 订阅 upgrade 事件
9. `ReaderHeader` 展示两级进度

**回滚**：降级 CACHE_VERSION 至 2，恢复旧 `ragIngest` 逻辑，删除 upgrade 事件。所有改动集中在 `rag-handler.ts` 中，回滚范围清晰。

## Open Questions

- 中文书籍是否需要针对中文字符密度调整 CHUNK_SIZE 公式？（暂按字符数统一处理，观察效果）
- `MAX_SEMANTIC_CHUNKS = 10,000` 是否合适，是否需要根据可用内存动态调整？（暂时硬编码，后续再观察）
