## Context

`src/workers/` 目录为空，项目尚无 Worker 基础设施。`docs/spikes/spike-transformers-worker.ts` 已验证了 `@xenova/transformers` 在 Worker 中的可行性。`electron.vite.config.ts` 已预配置了 `optimizeDeps.exclude: ['@xenova/transformers']` 和 `worker.format: 'es'`。本次需要建立正式的消息协议、Worker 入口和渲染进程通信层。

## Goals / Non-Goals

**Goals:**
- 定义严格类型化的 Worker 消息协议（WorkerMessage / WorkerResponse 联合类型）
- 实现 Worker 入口文件，支持 ingest / search / status / ping 消息分发
- 实现 Embedding 模型单例加载（all-MiniLM-L6-v2, quantized, 384 维）
- 提供 `useRagWorker` Hook 封装 Worker 生命周期和通信
- 确保 Vite 构建兼容性（排除 transformers 预打包、ES 模块 Worker）

**Non-Goals:**
- 不实现 Orama 向量数据库集成（后续 change）
- 不实现 IndexedDB 持久化（后续 change）
- 不实现文本切分逻辑（后续 change）
- 不实现 EPUB 解析（后续 change）
- ingest 和 search 消息的完整业务逻辑为 placeholder，仅搭建框架

## Decisions

### D1: 消息协议使用 Discriminated Union
将 `WorkerMessage` 和 `WorkerResponse` 定义为以 `type` 字段区分的联合类型。每种消息类型对应一个专属接口。

**备选方案**: 通用 `{ type: string; payload: unknown }` → 太松散，失去类型安全

### D2: rag-types.ts 独立于 rag.worker.ts
类型定义放在 `src/workers/rag-types.ts`，与 Worker 实现分离。渲染进程侧（useRagWorker）和 Worker 侧共享同一套类型。

**备选方案**: 类型内联在 worker 文件中 → 渲染进程无法导入 Worker 文件的类型

### D3: 模型加载采用模块级闭包单例
在 Worker 文件中通过模块级 `let` 变量保存 pipeline 实例，配合 `getEmbeddingPipeline()` 函数实现单例。与 spike 保持一致。

**备选方案**: Class 单例 → 过度封装，Pipeline API 本身就是函数式的

### D4: useRagWorker Hook 使用 useRef 持有 Worker 实例
Hook 内部用 `useRef<Worker>` 保持 Worker 引用，`useEffect` 负责创建和销毁。提供 `postMessage` 包装函数和 `onMessage` 回调注册。

**备选方案**: 全局 Worker 单例 → 与 React 生命周期脱节，难以清理

### D5: Worker 通过 Vite 的 `new Worker(new URL(...), { type: 'module' })` 加载
使用 Vite 原生的 Worker 导入语法，通过 `new URL('./rag.worker.ts', import.meta.url)` 引用 Worker 文件。Vite 会自动处理 Worker 的打包。

**备选方案**: `?worker` 后缀导入 → 与 electron-vite 的兼容性不确定

### D6: ingest/search 消息在本阶段返回 placeholder 响应
Worker 接收 ingest 和 search 消息后返回 `{ type: 'error', message: 'Not implemented' }` 或空结果。完整实现留给后续 Orama 集成 change。ping 和 status 消息提供真实响应。

**备选方案**: 完全不处理 → 无法验证消息分发流程

### D7: Vite 配置不修改
`electron.vite.config.ts` 已预配置了 `optimizeDeps.exclude` 和 `worker.format: 'es'`，无需额外修改。

**备选方案**: 新增配置 → 重复，当前配置已满足需求

## Risks / Trade-offs

- **[Risk] @xenova/transformers 与 Electron 的兼容性** → 已通过 spike 验证可行；如遇问题可切换到 `@huggingface/transformers` v3
- **[Risk] Worker 中模型首次加载耗时（~5s）** → ping 消息可提前预热；后续 change 添加加载进度上报
- **[Risk] Worker 类型安全依赖于手动 postMessage** → 通过 useRagWorker Hook 统一封装，减少直接 postMessage 调用
- **[Trade-off] ingest/search 为 placeholder** → 本阶段聚焦基础设施，完整实现需等 Orama 集成
