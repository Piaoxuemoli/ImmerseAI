## 1. 依赖安装

- [x] 1.1 安装 `@orama/orama` 和 `@orama/plugin-data-persistence`
- [x] 1.2 安装 `langchain`（仅使用 `langchain/text_splitter` 子路径）
- [x] 1.3 验证三个新依赖在 `npx tsc --noEmit` 下无类型错误

## 2. IndexedDB 辅助函数

- [x] 2.1 在 `rag.worker.ts` 中实现 `saveToIndexedDB(key: string, data: string): Promise<void>` — 使用原生 IndexedDB API 打开 `immerseai-rag` 数据库，写入 objectStore
- [x] 2.2 实现 `loadFromIndexedDB(key: string): Promise<string | null>` — 从 IndexedDB 读取指定 key 的数据，不存在时返回 null
- [x] 2.3 实现 `existsInIndexedDB(key: string): Promise<boolean>` — 检查 key 是否存在于 IndexedDB
- [x] 2.4 确保三个函数均使用 Promise 封装 IndexedDB 回调式 API

## 3. Orama 索引管理

- [x] 3.1 在 `rag.worker.ts` 顶部添加 `import { create, insert } from '@orama/orama'` 和 `import { persist, restore } from '@orama/plugin-data-persistence'`
- [x] 3.2 创建模块级 `const bookIndexes = new Map<string, Orama>()` 存放 per-book Orama 实例
- [x] 3.3 实现 `createBookIndex(): Promise<Orama>` — 创建 schema 为 `{ text: 'string', chapter: 'string', cfi: 'string', embedding: 'vector[384]' }` 的 Orama 实例
- [x] 3.4 实现 `restoreBookIndex(bookId: string): Promise<boolean>` — 从 IndexedDB 加载已持久化索引，恢复到内存 Map，返回是否成功

## 4. 文本切分

- [x] 4.1 在 `rag.worker.ts` 中添加 `import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'`
- [x] 4.2 实现 `splitChapters(chapters: Chapter[]): Promise<Array<{ text: string; chapter: string; cfi: string }>>` — 对每个 chapter 的 text 使用 RecursiveCharacterTextSplitter(500, 50, separators: ["\n\n", "\n", "。", " "]) 切分，每个 chunk 继承 chapter 的 title 和 cfi

## 5. Ingest Pipeline 实现

- [x] 5.1 实现 `handleIngest(bookId: string, chapters: Chapter[]): Promise<void>` 函数作为 ingest 主逻辑
- [x] 5.2 空章节快速路径：chapters 为空时直接 reply `ingest:complete` (chunkCount: 0) 并 return
- [x] 5.3 调用 `splitChapters` 获取所有 chunks
- [x] 5.4 若 bookId 已存在于 `bookIndexes` Map，先删除旧实例
- [x] 5.5 调用 `createBookIndex()` 创建新 Orama 实例
- [x] 5.6 发送 progress = 0 的初始进度
- [x] 5.7 按 batch=32 循环处理 chunks：提取 batch 的 text 数组 → 调用 `embed(batchTexts)` → 逐条调用 `insert(db, { text, chapter, cfi, embedding })` 插入 Orama
- [x] 5.8 每个 batch 完成后计算 `Math.floor((processed / total) * 100)`，与上次上报值比较，变化 ≥ 10 时发送 `ingest:progress`
- [x] 5.9 所有 batch 完成后发送 progress = 100
- [x] 5.10 将 Orama 实例存入 `bookIndexes` Map
- [x] 5.11 调用 `persist(db, 'json')` 序列化，然后 `saveToIndexedDB('book_{bookId}', serialized)` 持久化
- [x] 5.12 发送 `{ type: 'ingest:complete', bookId, chunkCount }` 完成消息

## 6. Status 升级

- [x] 6.1 修改 `case 'status'`：先检查 `bookIndexes.has(bookId)`，再调用 `existsInIndexedDB('book_{bookId}')`，任一为 true 则 `isIndexed: true`

## 7. Worker 消息分发更新

- [x] 7.1 将 `case 'ingest'` 从 placeholder 替换为调用 `handleIngest(message.bookId, message.chapters)`
- [x] 7.2 确保 `handleIngest` 在 try-catch 内执行，异常时 reply error

## 8. 验证

- [x] 8.1 `npx tsc --noEmit` 零错误
- [x] 8.2 `npm run build` 成功
- [x] 8.3 确认 `rag.worker.ts` 中无 `any` 类型（已有 eslint-disable 行除外）
- [x] 8.4 确认所有新增函数均在 Worker 文件内（P-2 合规：渲染进程不含计算逻辑）
