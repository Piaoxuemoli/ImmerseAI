import { useEffect, useRef, useCallback } from 'react'
import type { WorkerMessage, WorkerResponse } from '../../workers/rag-types'

/**
 * RAG Worker 通信 Hook
 *
 * 封装 Worker 实例的创建、销毁和消息通信。
 * Worker 在组件挂载时创建，卸载时销毁。
 *
 * @param onMessage - Worker 响应回调
 * @returns { postMessage } - 发送消息到 Worker 的函数
 */
export function useRagWorker(onMessage: (response: WorkerResponse) => void) {
  const workerRef = useRef<Worker | null>(null)
  const onMessageRef = useRef(onMessage)

  // 保持回调引用最新
  onMessageRef.current = onMessage

  useEffect(() => {
    const worker = new Worker(
      new URL('../../workers/rag.worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      onMessageRef.current(event.data)
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const postMessage = useCallback((message: WorkerMessage) => {
    workerRef.current?.postMessage(message)
  }, [])

  return { postMessage }
}
