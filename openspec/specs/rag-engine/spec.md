# RAG 引擎规范

## 目的
定义本地 RAG 引擎的索引流程、检索接口和缓存策略。

## 需求

### Requirement: Web Worker 隔离
RAG 引擎的所有代码 SHALL 在 Web Worker 中运行。
渲染进程 SHALL 仅通过 postMessage 与 Worker 通信。

### Requirement: 索引管道
系统 SHALL 按以下顺序执行索引：
1. 解析 EPUB 提取章节文本（保留 CFI）
2. RecursiveCharacterTextSplitter 切分（chunkSize:500, overlap:50）
3. all-MiniLM-L6-v2 生成 384 维向量
4. 存入 Orama 向量数据库

#### Scenario: 首次打开书籍
- WHEN 用户首次打开一本未索引的书
- THEN 系统执行完整索引管道
- AND 每完成 10% 向渲染进程发送 progress 消息
- AND 完成后持久化到 IndexedDB

### Requirement: 缓存策略
系统 SHALL 在 IndexedDB 中缓存已完成的索引。
Key 格式为 `book_{bookId}`。

#### Scenario: 再次打开已索引书籍
- WHEN 用户再次打开已索引的书
- THEN 系统从 IndexedDB 加载索引到内存
- AND 加载时间 SHALL 小于 500ms

### Requirement: 语义检索
search(bookId, query, topK=5) SHALL 返回：
- text: 匹配文本片段
- cfi: epub 定位符
- chapter: 章节名
- score: 相似度 (0-1)

### Requirement: 模型单例
Embedding 模型 SHALL 使用单例模式加载。
仅在首次调用 embed 时加载模型，后续复用实例。
