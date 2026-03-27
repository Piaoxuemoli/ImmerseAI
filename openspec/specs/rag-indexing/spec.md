## Requirements

### Requirement: 文本切分
系统 SHALL 根据书籍总字符数动态计算 `CHUNK_SIZE` 和 `CHUNK_OVERLAP`（详见 `rag-adaptive-chunking` 规范），而非使用固定值 500/50。切分分隔符 SHALL 保持 `["\n\n", "\n", "。", " "]` 不变。每个 chunk SHALL 继承其所属段落的 `paragraphIndex`（用于追踪位置）。

#### Scenario: 标准章节切分（短书）
- **WHEN** 书籍总字符数为 100,000，ingest 接收一个 2,000 字的段落
- **THEN** 系统使用 CHUNK_SIZE=500 切分，产生约 4-5 个 chunks

#### Scenario: 大书使用更大 CHUNK_SIZE
- **WHEN** 书籍总字符数为 50,000,000，ingest 接收一个 8,000 字的段落
- **THEN** 系统使用 CHUNK_SIZE=2000 切分，产生约 4 个 chunks（而非 16 个）

#### Scenario: 短段落不切分（任意书大小）
- **WHEN** 段落字符数 ≤ 该书的 CHUNK_SIZE
- **THEN** 该段落作为单个 chunk 保留，不产生额外切分

### Requirement: 批量向量化
系统 SHALL 将切分后的 chunks 按 batch size 32 分批调用 `embed()` 函数生成 384 维向量。每个 batch 处理完成后再处理下一个 batch。

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

### Requirement: 两阶段索引流程
`ragIngest` SHALL 根据 chunk 总数判断是否进入两阶段模式：

**阶段 1（立即，同步，<2s）**：
1. 计算 `contentHash`
2. 切分段落（使用自适应 CHUNK_SIZE）
3. 若 chunks ≤ `SEMANTIC_FULL_THRESHOLD`：走原有全量语义路径，结束
4. 若 chunks > `SEMANTIC_FULL_THRESHOLD`：立即构建词法索引（无 embedding），保存 `mode:'lexical'` 缓存，发送 `rag:ingest-complete`

**阶段 2（后台，异步，无阻塞）**：
5. 语义采样（见 `rag-adaptive-chunking` 规范）
6. 批量 embedding 采样 chunk
7. 保存 `mode:'hybrid'` 缓存（覆盖 lexical 缓存）
8. 发送 `rag:upgrade-progress` / `rag:upgrade-complete`

#### Scenario: 小书全量语义索引（单阶段，无变化）
- **WHEN** 书籍切片后产生 3,000 chunks
- **THEN** 系统直接执行全量语义 embedding
- **AND** 保存 `mode:'semantic'` 缓存
- **AND** 发送 `rag:ingest-complete { mode: 'semantic' }`
- **AND** 不发送任何 `rag:upgrade-*` 事件

#### Scenario: 大书两阶段——阶段 1 立即就绪
- **WHEN** 书籍切片后产生 50,000 chunks
- **THEN** 系统在切片完成后立即保存词法缓存（mode:'lexical'）
- **AND** 发送 `rag:ingest-complete { mode: 'lexical' }`，此时书籍可用于对话
- **AND** `book.contentHash` 被设置，人格生成不再报 BOOK_NOT_INDEXED

#### Scenario: 大书两阶段——阶段 2 后台升级
- **WHEN** 阶段 1 完成后，后台语义升级开始
- **THEN** 系统周期性发送 `rag:upgrade-progress { bookId, progress: 0..100 }`
- **AND** 升级完成后保存 mode:'hybrid' 缓存（覆盖词法缓存）
- **AND** 发送 `rag:upgrade-complete { bookId, chunkCount }`

#### Scenario: 后台升级期间语义模型失败
- **WHEN** 后台 embedding 批处理抛出异常
- **THEN** 系统停止升级，词法缓存保持有效
- **AND** 不向前端发送 upgrade-complete
- **AND** 记录错误日志，但不影响用户当前的词法检索功能

### Requirement: 缓存版本管理
`CACHE_VERSION` SHALL 为 3。`loadCache` 读取缓存文件时，若版本号不为 3 SHALL 删除该文件并返回 `null`，触发重新索引。

#### Scenario: 旧版本缓存自动失效
- **WHEN** `loadCache` 读取到 `version: 2` 的缓存文件
- **THEN** 系统删除该文件
- **AND** 返回 `null`，触发完整重新索引
- **AND** 日志记录 `[RAG] Evicted stale cache vN → v3: {hash}`

#### Scenario: 当前版本缓存正常加载
- **WHEN** `loadCache` 读取到 `version: 3` 的缓存文件
- **THEN** 系统正常返回缓存数据，不执行重新索引

### Requirement: 进度上报（两级）
系统 SHALL 区分"初次索引进度"和"后台语义升级进度"两个独立进度流，使用不同 IPC 事件名，避免前端进度条跳变。

| 场景           | 事件                   | 含义                         |
|----------------|------------------------|------------------------------|
| 初次索引进度   | `rag:ingest-progress`  | 0→100，词法索引构建进度      |
| 初次索引完成   | `rag:ingest-complete`  | 携带 `mode` 字段             |
| 后台升级进度   | `rag:upgrade-progress` | 0→100，语义 embedding 进度   |
| 后台升级完成   | `rag:upgrade-complete` | 携带更新后的 `chunkCount`    |

#### Scenario: 初次索引和后台升级进度互不干扰
- **WHEN** 大书完成阶段 1（ingest-complete 已发），后台升级开始
- **THEN** 前端收到 `rag:upgrade-progress { progress: 0 }` 时，ingest 进度条已消失
- **AND** 前端展示独立的"语义增强"进度条，不与 ingest 进度复用

#### Scenario: 小书不发送 upgrade 事件
- **WHEN** 小书（单阶段语义）完成索引
- **THEN** 系统仅发送 `rag:ingest-complete`，不发送任何 `rag:upgrade-*` 事件
- **AND** 前端不显示语义升级进度条
