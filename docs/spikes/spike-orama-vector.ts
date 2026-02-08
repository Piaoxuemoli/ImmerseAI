// docs/spikes/spike-orama-vector.ts
// 最小化示例：Orama 创建向量索引 + 搜索 + 持久化
// 来源: https://docs.orama.com/docs/orama-js/search/vector-search

import { create, insert, search, save, load } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";

async function main() {
  // 1. 创建带向量字段的数据库
  const db = await create({
    schema: {
      text: "string",          // 文本内容
      chapter: "string",       // 章节名
      cfi: "string",           // epub 定位符
      embedding: "vector[384]" // 384维向量 (all-MiniLM-L6-v2)
    },
  });

  // 2. 插入文档（embedding 是 number[] 或 Float32Array）
  await insert(db, {
    text: "面壁者罗辑最终明白了黑暗森林法则的真正含义",
    chapter: "第二十三章 黑暗森林",
    cfi: "epubcfi(/6/14!/4/2/1:0)",
    embedding: new Array(384).fill(0).map(() => Math.random()), // 实际应由模型生成
  });

  await insert(db, {
    text: "章北海下达了自然选择前进四的命令",
    chapter: "第十五章 自然选择",
    cfi: "epubcfi(/6/10!/4/2/1:0)",
    embedding: new Array(384).fill(0).map(() => Math.random()),
  });

  // 3. 向量搜索
  const results = await search(db, {
    mode: "vector",
    vector: {
      value: new Array(384).fill(0).map(() => Math.random()), // 查询向量
      property: "embedding",
    },
    similarity: 0.5,   // 最低相似度阈值
    limit: 5,          // Top-K
  });
  console.log("Search results:", results.hits.map(h => ({
    text: h.document.text,
    score: h.score,
  })));

  // 4. 持久化到 JSON 字符串（可存入 IndexedDB）
  const serialized = await persist(db, "json");
  console.log("Serialized size:", typeof serialized === 'string' ? serialized.length : 'binary');

  // 5. 从 JSON 字符串恢复
  const restoredDb = await restore("json", serialized);
  console.log("✅ Database restored, searching again...");

  const results2 = await search(restoredDb, {
    mode: "vector",
    vector: {
      value: new Array(384).fill(0).map(() => Math.random()),
      property: "embedding",
    },
    limit: 3,
  });
  console.log("Restored search results:", results2.hits.length);
}

main().catch(console.error);
