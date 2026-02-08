## MODIFIED Requirements

### Requirement: Worker 消息分发
Worker 入口文件 `src/workers/rag.worker.ts` SHALL 通过 `self.onmessage` 监听消息，根据 `type` 字段分发到对应处理函数。所有消息处理 SHALL 包含 try-catch 错误处理，错误时回复 `{ type: 'error', message: string }` 响应。

#### Scenario: ping 消息处理
- **WHEN** Worker 接收 `{ type: 'ping' }` 消息
- **THEN** Worker 预热模型（调用 getEmbeddingPipeline）
- **AND** 加载完成后回复 `{ type: 'pong' }`

#### Scenario: status 消息处理
- **WHEN** Worker 接收 `{ type: 'status', bookId }` 消息
- **THEN** Worker 先检查内存 Map 中是否存在该 bookId 的 Orama 实例
- **AND** 若内存中不存在，检查 IndexedDB 中是否存在 `book_{bookId}` key
- **AND** 回复 `{ type: 'status:result', bookId, isIndexed }` 其中 isIndexed 为任一存在即 true

#### Scenario: ingest 消息处理
- **WHEN** Worker 接收 `{ type: 'ingest', bookId, chapters }` 消息
- **THEN** Worker 调用完整 ingest pipeline（切分 → 向量化 → Orama 存储 → 持久化）
- **AND** 过程中通过 `ingest:progress` 上报进度
- **AND** 完成后回复 `{ type: 'ingest:complete', bookId, chunkCount }`

#### Scenario: search 消息处理（placeholder）
- **WHEN** Worker 接收 `{ type: 'search' }` 消息
- **THEN** Worker 回复 `{ type: 'error', message: 'search not implemented' }`

#### Scenario: 未知消息类型
- **WHEN** Worker 接收未识别的 type
- **THEN** Worker 回复 `{ type: 'error', message: 'Unknown message type: <type>' }`

#### Scenario: 处理异常
- **WHEN** 消息处理过程中抛出异常
- **THEN** Worker 捕获异常并回复 `{ type: 'error', message: <error string> }`
