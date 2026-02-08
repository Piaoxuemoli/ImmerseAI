# ImmerseAI 关键依赖 API 速查手册

## 1. @modelcontextprotocol/sdk (MCP)

### 核心类
```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ListToolsResultSchema,
  CallToolResultSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
```

### 连接模式

```ts
// Stdio 模式（本项目使用）
const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
});
const client = new Client({ name: "app", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);
```

### 工具调用

```ts
// 列出工具
const { tools } = await client.request({ method: "tools/list" }, ListToolsResultSchema);

// 调用工具
const result = await client.request({
  method: "tools/call",
  params: { name: "list_directory", arguments: { path: "/books" } }
}, CallToolResultSchema);
// result.content 是 Array<{ type: "text", text: string }>
```

### 断开连接

```ts
await client.close();
```

---

## 2. @orama/orama

### 创建 + 插入 + 搜索

```ts
import { create, insert, search, count } from "@orama/orama";

const db = await create({
  schema: {
    text: "string",
    chapter: "string",
    cfi: "string",
    embedding: "vector[384]",  // ← 维度必须匹配模型输出
  },
});

await insert(db, { text: "...", chapter: "...", cfi: "...", embedding: [...] });

// 向量搜索
const results = await search(db, {
  mode: "vector",
  vector: { value: queryVector, property: "embedding" },
  similarity: 0.5,
  limit: 5,
});
// results.hits[].document / results.hits[].score
```

### 持久化

```ts
import { persist, restore } from "@orama/plugin-data-persistence";

// 导出为 JSON 字符串
const data = await persist(db, "json");

// 从 JSON 恢复
const restoredDb = await restore("json", data);
```

⚠️ 注意：restore 后的 db 与原始 db 搜索行为应一致。
如果遇到 vector search 结果不一致（GitHub issue #695），
确保 persist/restore 使用相同的 format 参数。

---

## 3. @xenova/transformers (v2) / @huggingface/transformers (v3)

### 宪法指定 v2，但 v3 也兼容

```ts
// v2 引入方式
import { pipeline, env } from "@xenova/transformers";

// v3 引入方式（如果 v2 有兼容问题可切换）
// import { pipeline, env } from "@huggingface/transformers";
```

### Feature Extraction (Embedding)

```ts
env.allowLocalModels = true;

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
  { quantized: true }
);

const output = await extractor("要向量化的文本", {
  pooling: "mean",
  normalize: true,
});

const vector: number[] = output.tolist()[0]; // 384 维
```

### Vite + Web Worker 配置要点

```ts
// vite.config.ts
export default defineConfig({
  worker: {
    format: "es",  // Worker 使用 ES Module
  },
  optimizeDeps: {
    exclude: ["@xenova/transformers"], // 不要让 Vite 预打包此依赖
  },
});
```

---

## 4. react-reader

### 基础用法

```tsx
import { ReactReader } from "react-reader";
import type { Rendition, Contents } from "epubjs";

<ReactReader
  url={epubUrl}                            // string | ArrayBuffer
  location={currentCfi}                    // string | number
  locationChanged={(cfi) => setCfi(cfi)}   // 位置变化回调
  getRendition={(rendition) => {           // 获取 Rendition 实例
    renditionRef.current = rendition;
  }}
/>
```

### CFI 跳转

```ts
renditionRef.current.display("epubcfi(/6/14!/4/2/1:0)");
```

### 自定义主题

```ts
rendition.themes.default({
  body: { "font-family": "'Inter', sans-serif", color: "#0f172a" }
});
```

---

## 5. openai SDK (DeepSeek/Kimi 通用)

### 流式调用

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-xxx",
  baseURL: "https://api.deepseek.com",  // 或 https://api.moonshot.cn/v1
});

const stream = await client.chat.completions.create({
  model: "deepseek-chat",  // 或 "moonshot-v1-8k"
  messages: [...],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || "";
  // 逐字传给前端
}
```
