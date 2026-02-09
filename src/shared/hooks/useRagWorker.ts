import { useEffect, useRef, useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { WorkerMessage, WorkerResponse, Chapter } from '../../workers/rag-types'

/** Worker 最大重启次数 */
const MAX_RESTART_COUNT = 3

/**
 * RAG Worker 通信 Hook
 *
 * 封装 Worker 实例的创建、销毁、崩溃检测与自动重启。
 * Worker 在组件挂载时创建，卸载时销毁。
 * 崩溃时自动重启（最多 3 次），超限后提示用户刷新页面。
 *
 * @param onMessage - Worker 响应回调
 * @returns { postMessage, isWorkerReady } - 发送消息函数与 Worker 就绪状态
 */
export function useRagWorker(onMessage: (response: WorkerResponse) => void) {
  const workerRef = useRef<Worker | null>(null)
  const onMessageRef = useRef(onMessage)
  const restartCountRef = useRef(0)
  const [isWorkerReady, setIsWorkerReady] = useState(false)

  // 保持回调引用最新
  onMessageRef.current = onMessage

  /**
   * 创建并初始化 Worker
   * @returns 新创建的 Worker 实例
   */
  const createWorker = useCallback((): Worker | null => {
    // 检查是否超过最大重启次数
    if (restartCountRef.current >= MAX_RESTART_COUNT) {
      console.error('[useRagWorker] 已达到最大重启次数，不再重启')
      setIsWorkerReady(false)
      toast.error('RAG 服务暂时不可用，请刷新页面重试')
      return null
    }

    try {
      const worker = new Worker(
        new URL('../../workers/rag.worker.ts', import.meta.url),
        { type: 'module' }
      )

      // 消息监听
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        onMessageRef.current(event.data)
      }

      // 错误监听 - Worker 执行错误
      worker.onerror = (event: ErrorEvent) => {
        console.error('[useRagWorker] Worker 错误:', event.message)
        event.preventDefault()
        handleWorkerCrash()
      }

      // messageerror 监听 - 消息反序列化失败
      worker.onmessageerror = (event: MessageEvent) => {
        console.error('[useRagWorker] Worker 消息错误:', event)
        handleWorkerCrash()
      }

      setIsWorkerReady(true)
      return worker
    } catch (error) {
      console.error('[useRagWorker] Worker 创建失败:', error)
      handleWorkerCrash()
      return null
    }
  }, [])

  /**
   * 处理 Worker 崩溃 - 尝试重启或提示用户
   */
  const handleWorkerCrash = useCallback(() => {
    // 清理当前 Worker
    if (workerRef.current) {
      try {
        workerRef.current.terminate()
      } catch { /* ignore */ }
      workerRef.current = null
    }

    setIsWorkerReady(false)
    restartCountRef.current += 1

    console.warn(`[useRagWorker] 崩溃，尝试重启 (${restartCountRef.current}/${MAX_RESTART_COUNT})`)

    // 尝试重启
    if (restartCountRef.current < MAX_RESTART_COUNT) {
      // 延迟重启，避免立即崩溃循环
      setTimeout(() => {
        const newWorker = createWorker()
        if (newWorker) {
          workerRef.current = newWorker
          toast.warning('RAG 服务已重新启动')
        }
      }, 500)
    } else {
      // 超过最大重启次数
      toast.error('RAG 服务暂时不可用，请刷新页面重试')
    }
  }, [createWorker])

  // 初始化 Worker
  useEffect(() => {
    const worker = createWorker()
    if (worker) {
      workerRef.current = worker
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [createWorker])

  /**
   * 发送消息到 Worker
   * 如果 Worker 不可用则忽略
   */
  const postMessage = useCallback((message: WorkerMessage) => {
    if (!workerRef.current) {
      console.warn('[useRagWorker] Worker 不可用，忽略消息')
      return
    }

    try {
      workerRef.current.postMessage(message)
    } catch (error) {
      console.error('[useRagWorker] postMessage 失败:', error)
      handleWorkerCrash()
    }
  }, [handleWorkerCrash])

  const ingest = useCallback((bookId: string, chapters: Chapter[]) => {
    postMessage({ type: 'ingest', bookId, chapters })
  }, [postMessage])

  const search = useCallback((bookId: string, query: string, topK = 5, requestId?: string) => {
    postMessage({ type: 'search', bookId, query, topK, requestId })
  }, [postMessage])

  const getStatus = useCallback((bookId: string, requestId?: string) => {
    postMessage({ type: 'status', bookId, requestId })
  }, [postMessage])

  const ping = useCallback(() => {
    postMessage({ type: 'ping' })
  }, [postMessage])

  return { postMessage, ingest, search, getStatus, ping, isWorkerReady }
}
