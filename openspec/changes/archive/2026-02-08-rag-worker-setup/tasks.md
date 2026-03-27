## 1. 依赖安装

- [x] 1.1 安装 `@xenova/transformers` 依赖: `npm install @xenova/transformers`
- [x] 1.2 验证 `@xenova/transformers` 模块可解析: `node -e "require.resolve('@xenova/transformers')"`

## 2. Worker 消息协议类型 (rag-types.ts)

- [x] 2.1 创建 `src/workers/rag-types.ts` 文件
- [x] 2.2 定义并导出 `Chapter` 接口: `{ title: string; text: string; cfi: string }`
- [x] 2.3 定义并导出 `SearchResult` 接口: `{ text: string; cfi: string; chapter: string; score: number }`
- [x] 2.4 定义 `IngestMessage` 类型: `{ type: 'ingest'; bookId: string; chapters: Chapter[] }`
- [x] 2.5 定义 `SearchMessage` 类型: `{ type: 'search'; bookId: string; query: string; topK?: number }`
- [x] 2.6 定义 `StatusMessage` 类型: `{ type: 'status'; bookId: string }`
- [x] 2.7 定义 `PingMessage` 类型: `{ type: 'ping' }`
- [x] 2.8 导出 `WorkerMessage` 为以上四种消息的联合类型
- [x] 2.9 定义 `IngestProgressResponse`: `{ type: 'ingest:progress'; bookId: string; progress: number }`
- [x] 2.10 定义 `IngestCompleteResponse`: `{ type: 'ingest:complete'; bookId: string; chunkCount: number }`
- [x] 2.11 定义 `SearchResultResponse`: `{ type: 'search:result'; results: SearchResult[] }`
- [x] 2.12 定义 `StatusResultResponse`: `{ type: 'status:result'; bookId: string; isIndexed: boolean }`
- [x] 2.13 定义 `PongResponse`: `{ type: 'pong' }`
- [x] 2.14 定义 `ErrorResponse`: `{ type: 'error'; message: string }`
- [x] 2.15 导出 `WorkerResponse` 为以上六种响应的联合类型

## 3. Worker 入口 — 模型单例 (rag.worker.ts)

- [x] 3.1 创建 `src/workers/rag.worker.ts` 文件
- [x] 3.2 导入 `pipeline` 和 `env` from `@xenova/transformers`
- [x] 3.3 设置 `env.allowLocalModels = true`
- [x] 3.4 声明模块级 `let embeddingPipeline` 变量 (初始 null)
- [x] 3.5 实现 `getEmbeddingPipeline()` 函数: 单例加载 `Xenova/all-MiniLM-L6-v2` quantized 模型
- [x] 3.6 实现 `embed(texts: string[]): Promise<number[][]>` 函数: pooling='mean', normalize=true, 返回 384 维向量

## 4. Worker 入口 — 消息分发 (rag.worker.ts)

- [x] 4.1 导入 `WorkerMessage` 和 `WorkerResponse` 类型 from `./rag-types`
- [x] 4.2 实现 `self.onmessage` 处理函数，根据 `event.data.type` 分发
- [x] 4.3 实现 `ping` 消息处理: 调用 `getEmbeddingPipeline()` 预热，回复 `{ type: 'pong' }`
- [x] 4.4 实现 `status` 消息处理: 回复 `{ type: 'status:result', bookId, isIndexed: false }`
- [x] 4.5 实现 `ingest` 消息 placeholder: 回复 `{ type: 'error', message: 'ingest not implemented' }`
- [x] 4.6 实现 `search` 消息 placeholder: 回复 `{ type: 'error', message: 'search not implemented' }`
- [x] 4.7 实现 `default` 分支: 回复 `{ type: 'error', message: 'Unknown message type: <type>' }`
- [x] 4.8 所有消息处理包裹在 try-catch 中，错误时回复 `{ type: 'error', message }`

## 5. useRagWorker Hook

- [x] 5.1 创建 `src/shared/hooks/useRagWorker.ts` 文件
- [x] 5.2 Hook 签名: `useRagWorker(onMessage: (response: WorkerResponse) => void)`
- [x] 5.3 使用 `useRef<Worker | null>` 持有 Worker 实例
- [x] 5.4 在 `useEffect` 中通过 `new Worker(new URL('../../workers/rag.worker.ts', import.meta.url), { type: 'module' })` 创建 Worker
- [x] 5.5 设置 Worker `onmessage` 监听器，将 `event.data` 作为 `WorkerResponse` 传递给 `onMessage` 回调
- [x] 5.6 在 `useEffect` cleanup 中调用 `worker.terminate()` 销毁 Worker
- [x] 5.7 实现 `postMessage` 包装函数: ref 为 null 时静默忽略
- [x] 5.8 返回 `{ postMessage }` 对象

## 6. 验证

- [x] 6.1 TypeScript 编译检查: `npx tsc --noEmit` 零错误
- [x] 6.2 生产构建检查: `npm run build` 成功
- [x] 6.3 确认 rag-types.ts 导出所有类型 (WorkerMessage, WorkerResponse, Chapter, SearchResult)
- [x] 6.4 确认 rag.worker.ts 无 `any` 类型使用 (除 embeddingPipeline 的 transformers 返回值)
