// docs/spikes/spike-transformers-worker.ts
// 最小化示例：在 Web Worker 中使用 Transformers.js 生成 embedding
// 注意: @xenova/transformers 是 v2，v3 改名为 @huggingface/transformers
// 本项目宪法指定使用 @xenova/transformers，如遇到问题可切换到 v3

// ===== rag.worker.ts =====
import { pipeline, env } from "@xenova/transformers";

// 配置：禁用远程模型检查（使用本地缓存）
env.allowLocalModels = true;

// 单例模式：模型只加载一次
let embeddingPipeline: any = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log("⏳ Loading embedding model (first time only)...");
    embeddingPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",  // 自动下载量化模型，约 23MB
      { quantized: true }
    );
    console.log("✅ Model loaded");
  }
  return embeddingPipeline;
}

// 生成向量
async function embed(texts: string[]): Promise<number[][]> {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(texts, {
    pooling: "mean",
    normalize: true,
  });
  // output.tolist() 返回 number[][]，每个元素是 384 维向量
  return output.tolist();
}

// Worker 消息处理
self.onmessage = async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case "embed": {
      try {
        const vectors = await embed(payload.texts);
        self.postMessage({ type: "embed:result", vectors });
      } catch (error) {
        self.postMessage({ type: "error", message: String(error) });
      }
      break;
    }
    case "ping": {
      // 预热模型
      await getEmbeddingPipeline();
      self.postMessage({ type: "pong", message: "Model ready" });
      break;
    }
  }
};
