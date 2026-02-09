## 1. 新增 Orama search 导入

- [x] 1.1 在 `src/workers/rag.worker.ts` 顶部的 `@orama/orama` 导入中添加 `search`（当前仅导入 `create` 和 `insert`）

## 2. 实现 handleSearch 函数

- [x] 2.1 在 `rag.worker.ts` 中创建 `async function handleSearch(bookId: string, query: string, topK: number)` 函数
- [x] 2.2 实现索引获取：先检查 `bookIndexes.has(bookId)`，若 false 则调用 `restoreBookIndex(bookId)` 尝试从 IndexedDB 恢复
- [x] 2.3 实现未索引错误：恢复失败后回复 `{ type: 'error', message: '该书籍尚未建立索引，请先打开书籍完成索引' }`
- [x] 2.4 实现 query 向量化：调用 `embed([query])` 取 `result[0]` 作为搜索向量
- [x] 2.5 实现 Orama 向量检索：调用 `search(db, { mode: 'vector', vector: { value: queryVector, property: 'embedding' }, limit: topK })`
- [x] 2.6 实现结果映射：将 `hits` 映射为 `SearchResult[]`（`{ text: hit.document.text, cfi: hit.document.cfi, chapter: hit.document.chapter, score: hit.score }`）
- [x] 2.7 回复 `{ type: 'search:result', results }` 消息

## 3. 更新 search case 分支

- [x] 3.1 将 `case 'search'` 中的 `reply({ type: 'error', message: 'search not implemented' })` 替换为调用 `await handleSearch(message.bookId, message.query, message.topK ?? 5)`

## 4. 验证

- [x] 4.1 TypeScript 编译验证：`npx tsc --noEmit` 无错误
- [x] 4.2 确认 `search` 已从 `@orama/orama` 正确导入且无命名冲突
