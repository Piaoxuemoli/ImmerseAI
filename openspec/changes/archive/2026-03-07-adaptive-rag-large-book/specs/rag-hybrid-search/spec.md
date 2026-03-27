## ADDED Requirements

### Requirement: 混合检索模式路由
`ragSearch` 函数 SHALL 根据缓存的 `mode` 字段选择检索策略：
- `mode === 'semantic'` → 纯语义检索（余弦相似度，现有逻辑）
- `mode === 'lexical'`  → 纯词法检索（Orama BM25，现有逻辑）
- `mode === 'hybrid'`   → 混合检索（RRF 融合，新增）

#### Scenario: hybrid 模式触发混合检索
- **WHEN** `ragSearch` 加载到 `mode: 'hybrid'` 的缓存
- **THEN** 系统 SHALL 执行语义路径 + 词法路径双路检索
- **AND** 通过 RRF 算法融合结果后返回 topK 条

#### Scenario: semantic/lexical 模式保持现有逻辑
- **WHEN** `ragSearch` 加载到 `mode: 'semantic'` 或 `mode: 'lexical'` 的缓存
- **THEN** 系统 SHALL 使用现有单路检索逻辑，不经过 RRF
- **AND** 返回结果格式与现有格式一致

---

### Requirement: RRF 融合算法
混合检索 SHALL 使用 Reciprocal Rank Fusion（RRF）合并语义和词法两路结果。  
RRF 参数 `k = 60`（常量 `RRF_K`）。  
双路各召回 `topK × 2` 条候选，融合后取排名前 `topK` 条返回。

融合公式：
```
score(doc) = 1/(RRF_K + rank_semantic) + 1/(RRF_K + rank_lexical)
```
若某文档仅出现在一路结果中，另一路的 rank 视为 `Infinity`（贡献分为 0）。

#### Scenario: 双路均命中时分数叠加
- **WHEN** 一个 chunk 在语义搜索排名第 1，词法搜索排名第 2
- **THEN** 其 RRF 分数 = 1/(60+1) + 1/(60+2) = 0.01639 + 0.01613 ≈ 0.03252
- **AND** 该分数高于任何仅在单路出现的结果

#### Scenario: 仅词法命中的 chunk 参与排名
- **WHEN** 某 chunk 未被语义采样（无 embedding），词法搜索排名第 1
- **THEN** 其 RRF 分数 = 1/(60+1) ≈ 0.01639
- **AND** 该 chunk 仍可出现在最终结果中

#### Scenario: 去重保证唯一性
- **WHEN** 同一 chunk 同时出现在语义结果和词法结果中
- **THEN** 融合后的结果集中该 chunk 仅出现一次
- **AND** 使用两路排名综合计算的 RRF 分数

#### Scenario: 结果不足 topK 时返回实际数量
- **WHEN** 双路合并去重后结果总数少于 topK
- **THEN** 系统 SHALL 返回所有可用结果，不填充空条目

---

### Requirement: hybrid 模式缓存结构
`mode: 'hybrid'` 的缓存文件 SHALL 包含全量 chunks（含未采样的词法 chunk），采样 chunk 携带 `embedding`，其余 chunk `embedding` 字段缺失。  
`chunkCount` 字段记录全量 chunk 总数（含词法 chunk）。

#### Scenario: hybrid 缓存包含全量 chunk 文本
- **WHEN** 加载 `mode: 'hybrid'` 缓存
- **THEN** `cache.chunks.length` 等于全量切片数（含词法 chunk）
- **AND** 语义采样的 chunk 的 `embedding` 字段为 `number[]`
- **AND** 未采样 chunk 的 `embedding` 字段为 `undefined`

#### Scenario: 语义子集用于向量检索
- **WHEN** 执行混合检索的语义路径
- **THEN** 系统 SHALL 仅使用 `embedding !== undefined` 的 chunk 参与余弦相似度计算
- **AND** 不尝试访问 `undefined` embedding
