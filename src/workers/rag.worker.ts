// ============================================
// RAG Worker 入口文件
// 运行在 Web Worker 中，负责 Embedding 和消息分发
// ============================================

import { pipeline, env } from '@xenova/transformers'
import type { WorkerMessage, WorkerResponse } from './rag-types'

// 配置：允许本地模型缓存
env.allowLocalModels = true

// ---- Embedding 模型单例 ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingPipeline: ReturnType<typeof pipeline> extends Promise<infer T> ? T | null : never = null as any

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('[RAG Worker] Loading embedding model (first time only)...')
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true }
    )
    console.log('[RAG Worker] Model loaded')
  }
  return embeddingPipeline
}

/** 对文本数组生成 384 维向量 */
async function embed(texts: string[]): Promise<number[][]> {
  const extractor = await getEmbeddingPipeline()
  const output = await extractor(texts, {
    pooling: 'mean',
    normalize: true,
  })
  return output.tolist() as number[][]
}

// ---- 消息分发 ----

function reply(response: WorkerResponse) {
  self.postMessage(response)
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data

  try {
    switch (message.type) {
      case 'ping': {
        await getEmbeddingPipeline()
        reply({ type: 'pong' })
        break
      }

      case 'status': {
        reply({
          type: 'status:result',
          bookId: message.bookId,
          isIndexed: false, // Orama 未集成，始终 false
        })
        break
      }

      case 'ingest': {
        // Placeholder: 完整实现需等 Orama 集成
        reply({ type: 'error', message: 'ingest not implemented' })
        break
      }

      case 'search': {
        // Placeholder: 完整实现需等 Orama 集成
        reply({ type: 'error', message: 'search not implemented' })
        break
      }

      default: {
        const unknownType = (message as { type: string }).type
        reply({ type: 'error', message: `Unknown message type: ${unknownType}` })
        break
      }
    }
  } catch (error) {
    reply({ type: 'error', message: String(error) })
  }
}

// 导出 embed 供后续 ingest 实现使用
export { embed, getEmbeddingPipeline }
