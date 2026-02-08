## Requirements

### Requirement: Worker 消息协议类型
系统 SHALL 在 `src/workers/rag-types.ts` 中定义 `WorkerMessage` 和 `WorkerResponse` 两个 Discriminated Union 类型。`WorkerMessage` SHALL 以 `type` 字段区分，覆盖 `ingest`、`search`、`status`、`ping` 四种消息类型。`WorkerResponse` SHALL 以 `type` 字段区分，覆盖对应的响应类型和通用 `error` 类型。所有类型 SHALL 导出供渲染进程和 Worker 共同使用。

#### Scenario: ingest 消息类型定义
- **WHEN** 渲染进程需要发送索引请求
- **THEN** `WorkerMessage` 包含 `{ type: 'ingest'; bookId: string; chapters: Chapter[] }` 变体
- **AND** `Chapter` 接口包含 `title: string` 和 `text: string` 和 `cfi: string` 字段

#### Scenario: search 消息类型定义
- **WHEN** 渲染进程需要发送检索请求
- **THEN** `WorkerMessage` 包含 `{ type: 'search'; bookId: string; query: string; topK?: number }` 变体

#### Scenario: status 消息类型定义
- **WHEN** 渲染进程查询某本书的索引状态
- **THEN** `WorkerMessage` 包含 `{ type: 'status'; bookId: string }` 变体

#### Scenario: ping 消息类型定义
- **WHEN** 渲染进程需要预热模型或检查 Worker 存活
- **THEN** `WorkerMessage` 包含 `{ type: 'ping' }` 变体

#### Scenario: 响应类型覆盖
- **WHEN** Worker 处理完任意消息
- **THEN** `WorkerResponse` SHALL 包含以下变体之一：
  - `{ type: 'ingest:progress'; bookId: string; progress: number }` (0-100)
  - `{ type: 'ingest:complete'; bookId: string; chunkCount: number }`
  - `{ type: 'search:result'; results: SearchResult[] }`
  - `{ type: 'status:result'; bookId: string; isIndexed: boolean }`
  - `{ type: 'pong' }`
  - `{ type: 'error'; message: string }`

#### Scenario: SearchResult 接口定义
- **WHEN** Worker 返回检索结果
- **THEN** 每个 `SearchResult` SHALL 包含 `text: string`, `cfi: string`, `chapter: string`, `score: number` 字段

### Requirement: Embedding 模型单例加载
Worker SHALL 使用模块级闭包实现 `@xenova/transformers` 的 `all-MiniLM-L6-v2` (quantized) 模型单例加载。模型 SHALL 仅在首次调用 embed 时加载，后续调用复用同一实例。

#### Scenario: 首次加载模型
- **WHEN** Worker 首次接收需要 embedding 的消息（ping 或 ingest）
- **THEN** Worker 调用 `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })`
- **AND** 加载完成后缓存 pipeline 实例

#### Scenario: 后续调用复用模型
- **WHEN** Worker 已加载模型后再次接收 embed 请求
- **THEN** Worker 直接使用已缓存的 pipeline 实例
- **AND** 不重新加载模型

#### Scenario: embed 函数输出
- **WHEN** Worker 使用模型对文本数组生成 embedding
- **THEN** 返回 `number[][]`，每个元素为 384 维向量
- **AND** 使用 `pooling: 'mean'` 和 `normalize: true` 配置

### Requirement: Worker 消息分发
Worker 入口文件 `src/workers/rag.worker.ts` SHALL 通过 `self.onmessage` 监听消息，根据 `type` 字段分发到对应处理函数。所有消息处理 SHALL 包含 try-catch 错误处理，错误时回复 `{ type: 'error', message: string }` 响应。

#### Scenario: ping 消息处理
- **WHEN** Worker 接收 `{ type: 'ping' }` 消息
- **THEN** Worker 预热模型（调用 getEmbeddingPipeline）
- **AND** 加载完成后回复 `{ type: 'pong' }`

#### Scenario: status 消息处理
- **WHEN** Worker 接收 `{ type: 'status', bookId }` 消息
- **THEN** Worker 回复 `{ type: 'status:result', bookId, isIndexed: false }`
- **AND** 本阶段 isIndexed 始终为 false（Orama 未集成）

#### Scenario: ingest 消息处理（placeholder）
- **WHEN** Worker 接收 `{ type: 'ingest' }` 消息
- **THEN** Worker 回复 `{ type: 'error', message: 'ingest not implemented' }`

#### Scenario: search 消息处理（placeholder）
- **WHEN** Worker 接收 `{ type: 'search' }` 消息
- **THEN** Worker 回复 `{ type: 'error', message: 'search not implemented' }`

#### Scenario: 未知消息类型
- **WHEN** Worker 接收未识别的 type
- **THEN** Worker 回复 `{ type: 'error', message: 'Unknown message type: <type>' }`

#### Scenario: 处理异常
- **WHEN** 消息处理过程中抛出异常
- **THEN** Worker 捕获异常并回复 `{ type: 'error', message: <error string> }`

### Requirement: useRagWorker Hook
系统 SHALL 在 `src/shared/hooks/useRagWorker.ts` 提供 `useRagWorker` React Hook，封装 Worker 实例的创建、销毁和消息通信。

#### Scenario: Worker 实例生命周期
- **WHEN** 使用 `useRagWorker` 的组件挂载
- **THEN** Hook 通过 `new Worker(new URL('../workers/rag.worker.ts', import.meta.url), { type: 'module' })` 创建 Worker 实例
- **AND** 组件卸载时调用 `worker.terminate()` 清理

#### Scenario: 发送消息
- **WHEN** 调用 Hook 返回的 `postMessage(message: WorkerMessage)` 函数
- **THEN** 消息通过 Worker 实例的 `postMessage` 发送到 Worker 线程

#### Scenario: 接收响应
- **WHEN** Worker 回复消息
- **THEN** Hook 通过 `onmessage` 监听并调用 `onMessage` 回调参数
- **AND** 回调接收类型化的 `WorkerResponse` 对象

#### Scenario: Worker 未就绪时发送
- **WHEN** Worker 尚未创建完成（ref 为 null）时调用 postMessage
- **THEN** 消息被静默忽略，不抛出异常

#### Scenario: Hook 返回值
- **WHEN** 组件调用 `useRagWorker(onMessage)` 
- **THEN** Hook 返回 `{ postMessage: (msg: WorkerMessage) => void }` 对象
