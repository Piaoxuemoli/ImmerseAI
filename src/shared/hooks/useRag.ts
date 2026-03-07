/**
 * useRag — IPC-based RAG hook
 *
 * 管理两类进度状态：
 *   - ingest progress: 初次索引进度（词法建立，小书含 embedding）
 *   - upgrade progress: 后台语义升级进度（仅大书触发，不阻塞书籍可用性）
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import type { RagParagraph } from '@/shared/types'

interface IngestProgressData {
  bookId: string
  progress: number
}

interface IngestCompleteData {
  bookId: string
  contentHash: string
  chunkCount: number
  mode?: 'semantic' | 'lexical' | 'hybrid'
}

interface UpgradeProgressData {
  bookId: string
  progress: number
}

interface UpgradeCompleteData {
  bookId: string
  chunkCount: number
}

interface UseRagOptions {
  onIngestProgress?: (data: IngestProgressData) => void
  onIngestComplete?: (data: IngestCompleteData) => void
  onUpgradeProgress?: (data: UpgradeProgressData) => void
  onUpgradeComplete?: (data: UpgradeCompleteData) => void
}

export interface UseRagResult {
  ingest: (bookId: string, paragraphs: RagParagraph[]) => void
  /** 0-100 during semantic upgrade, null when no upgrade is in progress */
  upgradeProgress: number | null
  isUpgrading: boolean
}

export function useRag(options?: UseRagOptions): UseRagResult {
  const onProgressRef = useRef(options?.onIngestProgress)
  const onCompleteRef = useRef(options?.onIngestComplete)
  const onUpgradeProgressRef = useRef(options?.onUpgradeProgress)
  const onUpgradeCompleteRef = useRef(options?.onUpgradeComplete)

  const [upgradeProgress, setUpgradeProgress] = useState<number | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  // Keep refs in sync with latest callbacks (avoids stale closures in listeners)
  useEffect(() => { onProgressRef.current = options?.onIngestProgress }, [options?.onIngestProgress])
  useEffect(() => { onCompleteRef.current = options?.onIngestComplete }, [options?.onIngestComplete])
  useEffect(() => { onUpgradeProgressRef.current = options?.onUpgradeProgress }, [options?.onUpgradeProgress])
  useEffect(() => { onUpgradeCompleteRef.current = options?.onUpgradeComplete }, [options?.onUpgradeComplete])

  useEffect(() => {
    const unsubProgress = window.electronAPI.rag.onIngestProgress((data) => {
      onProgressRef.current?.(data)
    })

    const unsubComplete = window.electronAPI.rag.onIngestComplete((data) => {
      onCompleteRef.current?.(data)
      // If mode is 'lexical', a semantic upgrade will follow — don't signal "all done" yet
      // (upgrade-complete will be the final signal). We just let the caller handle it.
    })

    const unsubUpgradeProgress = window.electronAPI.rag.onUpgradeProgress((data) => {
      setIsUpgrading(true)
      setUpgradeProgress(data.progress)
      onUpgradeProgressRef.current?.(data)
    })

    const unsubUpgradeComplete = window.electronAPI.rag.onUpgradeComplete((data) => {
      setIsUpgrading(false)
      setUpgradeProgress(null)
      onUpgradeCompleteRef.current?.(data)
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubUpgradeProgress()
      unsubUpgradeComplete()
    }
  }, [])

  const ingest = useCallback((bookId: string, paragraphs: RagParagraph[]) => {
    window.electronAPI.rag.ingest(bookId, paragraphs)
  }, [])

  return { ingest, upgradeProgress, isUpgrading }
}
