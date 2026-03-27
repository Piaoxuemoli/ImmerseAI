# RAG 语义检索规范

## 目的
定义 RAG Worker 中语义检索功能的接口、自动恢复策略和错误处理。

## 需求

### Requirement: 语义检索函数
Worker SHALL 提供 `handleSearch(bookId: string, query: string, topK: number)` 函数，执行完整的语义检索流程：query 向量化 → Orama 向量搜索 → 结果映射。

#### Scenario: 标准检索流程
- **WHEN** Worker 接收 `{ type: 'search', bookId, query, topK }` 消息
- **THEN** 系统调用 `embed([query])` 将 query 转换为 384 维向量
- **AND** 使用该向量调用 Orama `search(db, { mode: 'vector', vector: { value, property: 'embedding' }, limit: topK })`
- **AND** 将 `hits` 映射为 `SearchResult[]` 回复 `{ type: 'search:result', results }`

#### Scenario: 使用默认 topK
- **WHEN** 消息中未提供 `topK` 或 `topK` 为 undefined
- **THEN** 系统 SHALL 使用默认值 `5`

#### Scenario: 结果映射
- **WHEN** Orama 返回 `hits` 数组
- **THEN** 每个 hit SHALL 映射为 `{ text: hit.document.text, cfi: hit.document.cfi, chapter: hit.document.chapter, score: hit.score }`
- **AND** score 直接使用 Orama 返回的余弦相似度值（0-1 范围）

#### Scenario: 空结果
- **WHEN** Orama 检索返回 0 个 hits
- **THEN** 系统 SHALL 回复 `{ type: 'search:result', results: [] }`
- **AND** 不视为错误

### Requirement: 索引自动恢复
Worker SHALL 在检索时自动恢复未加载到内存的索引，对调用方透明。

#### Scenario: 索引在内存中
- **WHEN** search 被调用且 `bookIndexes.has(bookId)` 为 true
- **THEN** 系统直接使用内存中的 Orama 实例执行检索
- **AND** 不访问 IndexedDB

#### Scenario: 索引不在内存但在 IndexedDB 中
- **WHEN** search 被调用且 `bookIndexes.has(bookId)` 为 false
- **THEN** 系统 SHALL 调用 `restoreBookIndex(bookId)` 从 IndexedDB 恢复索引到内存
- **AND** 恢复成功后使用恢复的实例执行检索
- **AND** 后续对同一 bookId 的检索直接使用内存实例

#### Scenario: 索引完全不存在
- **WHEN** search 被调用且内存和 IndexedDB 中均不存在该 bookId 的索引
- **THEN** 系统 SHALL 回复 `{ type: 'error', message: '该书籍尚未建立索引，请先打开书籍完成索引' }`

### Requirement: 检索错误处理
Worker SHALL 对检索过程中的异常提供完整错误处理。

#### Scenario: query 向量化失败
- **WHEN** `embed([query])` 调用抛出异常
- **THEN** 系统 SHALL 回复 `{ type: 'error', message: <异常信息> }`

#### Scenario: Orama search 调用失败
- **WHEN** Orama `search()` 调用抛出异常
- **THEN** 系统 SHALL 回复 `{ type: 'error', message: <异常信息> }`
