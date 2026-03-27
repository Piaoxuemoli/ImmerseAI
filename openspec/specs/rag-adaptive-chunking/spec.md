# RAG 自适应切块规范

## 目的
定义根据书籍规模自动调整 CHUNK_SIZE 的算法，以及超大书的语义采样策略。

## Requirements

### Requirement: 自适应 CHUNK_SIZE 计算
系统 SHALL 根据书籍总字符数（`totalChars`）通过分段函数计算 `CHUNK_SIZE`，而非使用固定值。  
`CHUNK_OVERLAP` SHALL 等于 `max(50, floor(CHUNK_SIZE × 0.1))`。

分段规则：

| totalChars 范围            | CHUNK_SIZE |
|---------------------------|------------|
| < 200,000                 | 500        |
| 200,000 – 1,999,999       | 1,000      |
| 2,000,000 – 9,999,999     | 2,000      |
| ≥ 10,000,000              | 4,000      |

最终 CHUNK_SIZE SHALL 被 clamp 至 [500, 8000]。

#### Scenario: 短文（<200k chars）使用最小 chunk size
- **WHEN** 书籍总字符数为 150,000
- **THEN** `adaptiveChunkSize(150000)` 返回 `{ chunkSize: 500, chunkOverlap: 50 }`

#### Scenario: 中长篇小说使用 1000 chunk size
- **WHEN** 书籍总字符数为 800,000
- **THEN** `adaptiveChunkSize(800000)` 返回 `{ chunkSize: 1000, chunkOverlap: 100 }`

#### Scenario: 长篇小说使用 2000 chunk size
- **WHEN** 书籍总字符数为 5,000,000
- **THEN** `adaptiveChunkSize(5000000)` 返回 `{ chunkSize: 2000, chunkOverlap: 200 }`

#### Scenario: 超长网文使用 4000 chunk size
- **WHEN** 书籍总字符数为 88,000,000
- **THEN** `adaptiveChunkSize(88000000)` 返回 `{ chunkSize: 4000, chunkOverlap: 400 }`

---

### Requirement: 大书语义采样
系统 SHALL 定义大书阈值 `SEMANTIC_FULL_THRESHOLD = 5000 chunks`。  
当切片后的 chunk 总数超过此阈值时，系统 SHALL 仅对采样子集执行语义 embedding，其余 chunk 仅保留文本（用于词法索引）。  
最大语义 chunk 数 SHALL 为 `MAX_SEMANTIC_CHUNKS = 10000`。

采样规则（按优先级）：
1. `headCount = min(2000, floor(totalChunks × 0.15))`，取书头 chunks
2. `tailCount = min(2000, floor(totalChunks × 0.15))`，取书尾 chunks
3. 剩余配额从中间段均匀间隔采样（`step = max(1, floor(midLength / midTarget))`）
4. 去重后总量 ≤ `MAX_SEMANTIC_CHUNKS`

采样后的 chunk SHALL 新增布尔字段 `isSemanticSampled: boolean`，标记该 chunk 是否被纳入语义采样。

#### Scenario: 小书不触发采样
- **WHEN** 书籍切片后产生 3,000 chunks
- **THEN** 所有 3,000 个 chunk 均被纳入语义 embedding
- **AND** 所有 chunk 的 `isSemanticSampled` 为 `true`

#### Scenario: 大书触发采样，头尾优先
- **WHEN** 书籍切片后产生 50,000 chunks
- **THEN** 前 2,000 个 chunk 被选入采样集
- **AND** 后 2,000 个 chunk 被选入采样集
- **AND** 中间段均匀间隔采样，总采样量 ≤ 10,000
- **AND** 未采样 chunk 的 `isSemanticSampled` 为 `false`，`embedding` 字段不存在

#### Scenario: 超大书（177k chunks）采样量控制在上限
- **WHEN** 书籍切片后产生 177,000 chunks
- **THEN** 采样集大小 ≤ 10,000
- **AND** 头段 chunk 和尾段 chunk 必然被纳入采样集

#### Scenario: 采样集均匀覆盖全书范围
- **WHEN** 书籍切片后产生 100,000 chunks，中间段有 96,000 个
- **THEN** 中间采样的步长 `step = floor(96000 / 6000) = 16`
- **AND** 中间段每 16 个 chunk 取 1 个，覆盖全书范围
