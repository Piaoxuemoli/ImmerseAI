## ADDED Requirements

### Requirement: 文本切分
Worker SHALL 使用 `RecursiveCharacterTextSplitter` 将章节文本切分为 chunks。切分参数 SHALL 为 `chunkSize: 500`、`chunkOverlap: 50`、`separators: ["\n\n", "\n", "。", " "]`。每个 chunk SHALL 继承其所属 chapter 的 `title`（存入 `chapter` 字段）和 `cfi`（存入 `cfi` 字段）。

#### Scenario: 标准章节切分
- **WHEN** ingest 接收一个 2000 字的 chapter
- **THEN** 系统使用 RecursiveCharacterTextSplitter(500, 50) 切分
- **AND** 产生约 4-5 个 chunks
- **AND** 每个 chunk 的 `chapter` 值为该 chapter 的 `title`
- **AND** 每个 chunk 的 `cfi` 值为该 chapter 的 `cfi`

#### Scenario: 短章节不切分
- **WHEN** ingest 接收一个少于 500 字的 chapter
- **THEN** 该 chapter 文本作为单个 chunk 保留
- **AND** 不产生额外切分

#### Scenario: 中文分隔符支持
- **WHEN** 章节文本包含中文句号（。）作为句边界
- **THEN** 切分器 SHALL 优先在 `\n\n`、`\n`、`。` 处切分
- **AND** 避免在句子中间断开

### Requirement: 批量向量化
Worker SHALL 将切分后的 chunks 按 batch size 32 分批调用 `embed()` 函数生成 384 维向量。每个 batch 处理完成后再处理下一个 batch。

#### Scenario: 标准批次处理
- **WHEN** ingest 产生 100 个 chunks
- **THEN** 系统分为 4 个 batch（32 + 32 + 32 + 4）依次处理
- **AND** 每个 batch 调用一次 `embed(batchTexts)`
- **AND** 返回的每个向量为 384 维 `number[]`

#### Scenario: 小于一个 batch
- **WHEN** ingest 产生 10 个 chunks（不足 32）
- **THEN** 系统以 1 个 batch 处理全部 10 个 chunks

#### Scenario: 内存安全
- **WHEN** 大书产生 1000+ chunks
- **THEN** 系统仍按 32 个一组依次处理
- **AND** 每个 batch 完成后释放前一次的中间结果

### Requirement: Orama 索引管理
Worker SHALL 维护 `Map<string, OramaInstance>` 管理 per-book 的 Orama 向量数据库实例。Orama schema SHALL 为 `{ text: 'string', chapter: 'string', cfi: 'string', embedding: 'vector[384]' }`。

#### Scenario: 创建新索引
- **WHEN** ingest 接收一个未索引的 bookId
- **THEN** 系统调用 `create({ schema: { text: 'string', chapter: 'string', cfi: 'string', embedding: 'vector[384]' } })` 创建新 Orama 实例
- **AND** 将实例存入内存 Map，key 为 bookId

#### Scenario: 插入文档
- **WHEN** 一个 batch 的向量化完成
- **THEN** 系统为该 batch 中每个 chunk 调用 `insert(db, { text, chapter, cfi, embedding })` 插入 Orama
- **AND** embedding 为 `embed()` 返回的 `number[]`

#### Scenario: 覆盖已有索引
- **WHEN** ingest 接收一个已在内存 Map 中存在的 bookId
- **THEN** 系统丢弃旧 Orama 实例
- **AND** 创建全新的 Orama 实例重新索引

### Requirement: 进度上报
Worker SHALL 在 ingest 过程中按 chunk 处理进度通过 `postMessage` 发送 `ingest:progress` 消息。进度值为 0-100 的整数。

#### Scenario: 进度计算
- **WHEN** 已处理 processed 个 chunks，总计 total 个
- **THEN** 进度值为 `Math.floor((processed / total) * 100)`

#### Scenario: 进度上报频率
- **WHEN** 当前计算的进度百分比相比上次上报值变化 ≥ 10
- **THEN** 系统发送 `{ type: 'ingest:progress', bookId, progress }` 消息
- **AND** 上报后更新上次上报值

#### Scenario: 首次和完成上报
- **WHEN** ingest 开始处理第一个 batch
- **THEN** 系统发送 progress = 0 的初始进度
- **WHEN** 所有 chunks 处理完成
- **THEN** 最终 progress 值 SHALL 达到 100（在 `ingest:complete` 之前发送）

### Requirement: IndexedDB 持久化
Worker SHALL 在 ingest 完成后将 Orama 索引持久化到 IndexedDB，key 格式为 `book_{bookId}`。系统 SHALL 提供 `saveToIndexedDB`、`loadFromIndexedDB`、`existsInIndexedDB` 三个辅助函数。

#### Scenario: ingest 完成后持久化
- **WHEN** ingest 所有 chunks 处理完成且 Orama 插入成功
- **THEN** 系统调用 `persist(db, 'json')` 序列化 Orama 实例
- **AND** 调用 `saveToIndexedDB('book_{bookId}', serializedData)` 存入 IndexedDB

#### Scenario: 从 IndexedDB 恢复索引
- **WHEN** 系统需要加载已持久化的索引（如用户再次打开已索引书籍）
- **THEN** 系统调用 `loadFromIndexedDB('book_{bookId}')` 获取序列化数据
- **AND** 调用 `restore('json', data)` 恢复 Orama 实例
- **AND** 将恢复的实例存入内存 Map

#### Scenario: 检查 IndexedDB 中索引存在性
- **WHEN** 调用 `existsInIndexedDB('book_{bookId}')`
- **THEN** 返回 `boolean` 表示该 key 是否存在于 IndexedDB

### Requirement: Ingest 完整流程编排
Worker 接收 `ingest` 消息后 SHALL 按以下顺序执行完整 pipeline：切分 → 批量向量化（含进度上报）→ Orama 存储 → IndexedDB 持久化 → 发送 `ingest:complete`。

#### Scenario: 完整 ingest 成功流程
- **WHEN** Worker 接收 `{ type: 'ingest', bookId: 'abc', chapters: [...] }`
- **THEN** 系统依次执行：
  1. 对所有 chapters 调用 RecursiveCharacterTextSplitter 切分
  2. 创建 Orama 实例
  3. 按 batch=32 向量化并插入 Orama（期间上报 progress）
  4. 调用 persist + saveToIndexedDB 持久化
  5. 回复 `{ type: 'ingest:complete', bookId: 'abc', chunkCount: N }`
- **AND** N 为切分后的总 chunk 数

#### Scenario: ingest 过程中异常
- **WHEN** ingest pipeline 任一步骤抛出异常
- **THEN** Worker 回复 `{ type: 'error', message: <error string> }`
- **AND** 不持久化不完整的索引
- **AND** 不发送 `ingest:complete`

#### Scenario: 空章节处理
- **WHEN** ingest 接收 chapters 数组为空
- **THEN** 系统回复 `{ type: 'ingest:complete', bookId, chunkCount: 0 }`
- **AND** 不创建 Orama 实例
