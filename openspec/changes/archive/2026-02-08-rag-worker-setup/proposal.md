## Why

项目宪法要求所有 RAG 计算（向量化、检索）必须运行在 Web Worker 中（核心原则 P-2: UI 零阻塞）。当前 `src/workers/` 目录为空，缺少 Worker 基础设施。需要建立 Worker 消息协议、模型加载单例、渲染进程通信 Hook 以及 Vite 构建兼容配置，为后续的 ingest/search 功能打下基础。

## What Changes

- 创建 `src/workers/rag-types.ts`：定义 `WorkerMessage` 和 `WorkerResponse` 类型联合，覆盖 `ingest` / `search` / `status` / `ping` 四种消息类型
- 创建 `src/workers/rag.worker.ts`：实现 Worker 入口，包含 `@xenova/transformers` 单例模型加载、消息分发框架，参考 `docs/spikes/spike-transformers-worker.ts`
- 创建 `src/shared/hooks/useRagWorker.ts`：封装 Worker 实例化、postMessage 发送、onmessage 监听的 React Hook
- 修改 `electron.vite.config.ts`：renderer 配置中排除 `@xenova/transformers` 的 Vite 预打包（optimizeDeps.exclude）
- 安装依赖 `@xenova/transformers`

## Capabilities

### New Capabilities
- `rag-worker`: Worker 消息协议定义、单例模型加载框架、Worker 入口文件和渲染进程通信 Hook

### Modified Capabilities
- `build-system`: renderer 配置新增 optimizeDeps.exclude 和 Worker 相关构建设置

## Impact

- **新增文件**: `src/workers/rag-types.ts`, `src/workers/rag.worker.ts`, `src/shared/hooks/useRagWorker.ts`
- **修改文件**: `electron.vite.config.ts`
- **新增依赖**: `@xenova/transformers`
- **受影响系统**: Vite 构建流程（renderer 配置）、渲染进程（新增 Worker 通信能力）
