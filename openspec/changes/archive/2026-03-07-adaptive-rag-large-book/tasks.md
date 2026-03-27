## 1. rag-handler.ts — 核心改造

- [x] 1.1 升级 `CACHE_VERSION = 3`，在 `loadCache` 中检测旧版本时删除文件并记录日志
- [x] 1.2 新增 `adaptiveChunkSize(totalChars: number): { chunkSize: number; chunkOverlap: number }` 函数，实现分段查表逻辑（4 档 + clamp）
- [x] 1.3 修改 `chunkParagraphs` 签名为接受 `chunkSize` 和 `chunkOverlap` 参数（或从调用处传入），移除模块级常量 `CHUNK_SIZE` / `CHUNK_OVERLAP`
- [x] 1.4 在 `RagChunk` 类型中新增 `isSemanticSampled: boolean` 字段
- [x] 1.5 新增 `sampleChunks(chunks: RagChunk[], maxSemantic: number): RagChunk[]` 函数，实现头/尾/均匀间隔采样逻辑
- [x] 1.6 重构 `ragIngest`：在切片后判断 chunks 数量，小于阈值走原有全量语义路径，超过阈值执行两阶段（立即词法 + 后台升级）
- [x] 1.7 `ragIngest` 的立即词法阶段：保存 `mode:'lexical'` 缓存，发送 `rag:ingest-complete { mode: 'lexical' }`，不再等待语义完成
- [x] 1.8 重构 `backgroundReindexSemantic`：改为先执行采样（`sampleChunks`），仅对采样 chunk 执行 embedding，完成后保存 `mode:'hybrid'` 缓存
- [x] 1.9 `backgroundReindexSemantic` 中发送 `rag:upgrade-progress` 事件（每批次更新）和 `rag:upgrade-complete` 事件
- [x] 1.10 新增 `hybridSearch(cache, queryEmbedding, query, topK)` 函数，实现语义子集余弦检索 + Orama 词法检索 + RRF 融合
- [x] 1.11 修改 `ragSearch` 路由逻辑：`mode === 'hybrid'` 时调用 `hybridSearch`，其余保持现有分支
- [x] 1.12 更新 `CacheFile` 类型：`mode` 增加 `'hybrid'`，`chunks[].embedding` 改为可选，新增 `chunks[].isSemanticSampled`

## 2. IPC 事件层

- [x] 2.1 在 `electron/preload/index.ts` 中新增 `rag.onUpgradeProgress` 和 `rag.onUpgradeComplete` 两个监听注册函数，返回取消订阅的函数
- [x] 2.2 在 `src/shared/types/electron.d.ts` 中新增 `onUpgradeProgress` 和 `onUpgradeComplete` 的类型声明
- [x] 2.3 更新 `rag:ingest-complete` 的 payload 类型，新增可选字段 `mode: 'semantic' | 'lexical' | 'hybrid'`

## 3. 前端 Hook

- [x] 3.1 修改 `src/shared/hooks/useRag.ts`：订阅 `onUpgradeProgress` / `onUpgradeComplete`，新增 `upgradeProgress: number | null`（null 表示无升级）和 `isUpgrading: boolean` 状态
- [x] 3.2 `useRag` 的 `onIngestComplete` 回调：当 payload.mode 为 `'lexical'` 时，不清除升级状态（等 upgrade-complete 再清）

## 4. 前端 UI

- [x] 4.1 修改 `src/features/reader/components/ReaderHeader.tsx`（或相关进度展示组件）：新增语义升级进度条展示区域，`isUpgrading` 为 `true` 时显示"语义增强中 X%"，`isUpgrading` 为 `false` 时隐藏
- [x] 4.2 确保两个进度条（初次索引 & 语义升级）不同时显示，状态机转换清晰（索引完成 → 升级进度 → 升级完成）
- [x] 4.3 词法索引完成后 `book.contentHash` 已设置，确认人格生成按钮/功能在该状态下可以正常触发（不报 BOOK_NOT_INDEXED）

## 5. 缓存清理（测试准备）

- [x] 5.1 删除 `userData/rag-cache/` 目录下所有 `.json` 缓存文件，确保测试时不命中旧缓存
- [x] 5.2 重置 Zustand store 中所有 book 的 `isIndexed`、`contentHash`、`chunkCount` 字段（或通过 CACHE_VERSION 升级自动失效），确保首次打开书籍时触发完整重新索引
