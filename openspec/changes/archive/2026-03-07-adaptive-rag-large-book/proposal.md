## Why

超大书籍（如完本网文）在当前固定 CHUNK_SIZE=500 下产生 10 万+ chunks，全量语义 embedding 需要 20-30 分钟，导致用户长时间无法使用人格对话功能。核心问题是索引策略对所有书籍一视同仁，没有按书的规模自适应调整。

## What Changes

- **自适应 CHUNK_SIZE**：根据书的总字数非线性调整切块大小，将语义 chunk 数量控制在合理上限内
- **两阶段索引**：词法索引立即完成（<1s）并标记书籍可用；语义升级在后台进行并向前端推送独立进度
- **语义采样**：超大书不全量 embed，而是对前段、尾段和均匀间隔采样，保留全书范围的语义覆盖
- **混合检索（Hybrid RRF）**：当索引为 `hybrid` 模式时，合并采样语义结果和全量词法结果，通过 Reciprocal Rank Fusion 重排，弥补语义覆盖缺失
- **新增 IPC 事件**：`rag:upgrade-progress` / `rag:upgrade-complete` 区分初次索引与后台升级两种进度场景
- **缓存版本升级**：CACHE_VERSION 升至 3，清除所有旧格式缓存强制重新索引

## Capabilities

### New Capabilities

- `rag-adaptive-chunking`: 自适应 CHUNK_SIZE 公式、语义采样策略（前/尾/均匀）、大书阈值判断逻辑
- `rag-hybrid-search`: 混合检索接口——对 hybrid 模式缓存执行语义+词法双路检索并通过 RRF 融合排名

### Modified Capabilities

- `rag-indexing`: 索引管道改为两阶段（立即词法 → 后台语义升级），新增 upgrade 进度事件，chunk 元数据增加 `isSemanticSampled` 标记

## Impact

- `electron/main/rag-handler.ts`：核心改动，涉及 CHUNK_SIZE 计算、采样逻辑、background upgrade、hybrid 搜索
- `electron/main/ipc-handlers.ts`：无需改动（upgrade 事件由 rag-handler 直接 emit）
- `electron/preload/index.ts`：新增 `onUpgradeProgress` / `onUpgradeComplete` 两个监听注册
- `src/shared/types/electron.d.ts`：新增 upgrade 事件类型声明
- `src/shared/hooks/useRag.ts`：订阅 upgrade 进度事件，暴露 `upgradeProgress` 状态
- `src/features/reader/ReaderPage.tsx` / `ReaderHeader.tsx`：展示两级进度（索引进度 & 语义升级进度）
- 缓存数据：CACHE_VERSION=3，所有 v1/v2 缓存文件自动失效，重新索引
