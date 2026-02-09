import { useState, useEffect, useRef, useCallback } from 'react'
import type { Rendition } from 'epubjs'
import { useStore } from '@/shared/store'

/**
 * useReader — EPUB 阅读器核心 Hook
 *
 * 职责：
 * 1. 通过 IPC (MCP readFile) 加载 EPUB → Blob URL
 * 2. 管理 loading / error 状态
 * 3. 管理 location (CFI) 并持久化到 Book.lastReadCfi
 * 4. 暴露 renditionRef 和 goToCfi 方法
 */
export function useReader(bookId: string) {
  const books = useStore((s) => s.books)
  const setBooks = useStore((s) => s.setBooks)
  const setCurrentCfi = useStore((s) => s.setCurrentCfi)
  const setReaderMode = useStore((s) => s.setReaderMode)
  const pendingCitationCfi = useStore((s) => s.pendingCitationCfi)
  const setPendingCitationCfi = useStore((s) => s.setPendingCitationCfi)
  const readerMode = useStore((s) => s.readerMode)

  const book = books.find((b) => b.id === bookId)

  // --- State ---
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 阅读进度：从 Book.lastReadCfi 恢复
  const [location, setLocation] = useState<string | number>(
    book?.lastReadCfi ?? 0,
  )

  const renditionRef = useRef<Rendition | null>(null)

  // 用于追踪上一次高亮的 CFI，便于清除
  const lastHighlightCfiRef = useRef<string | null>(null)

  // --- EPUB 加载 ---
  useEffect(() => {
    if (!book) {
      setError('书籍不存在')
      setLoading(false)
      return
    }

    let revoked = false
    let currentBlobUrl: string | null = null

    const loadEpub = async () => {
      try {
        setLoading(true)
        setError(null)

        const arrayBuffer = await window.electronAPI.mcp.readFile(book.path)
        if (revoked) return

        const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' })
        currentBlobUrl = URL.createObjectURL(blob)
        setBlobUrl(currentBlobUrl)
      } catch (err) {
        if (!revoked) {
          setError(String(err))
        }
      } finally {
        if (!revoked) {
          setLoading(false)
        }
      }
    }

    void loadEpub()

    // Cleanup: revoke Blob URL
    return () => {
      revoked = true
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }
    }
  }, [book])

  // --- Location Changed 回调 ---
  const handleLocationChanged = useCallback(
    (cfi: string) => {
      setLocation(cfi)
      setCurrentCfi(cfi)

      // 持久化到 Book.lastReadCfi
      if (book) {
        const updatedBooks = books.map((b) =>
          b.id === bookId
            ? { ...b, lastReadCfi: cfi, lastReadAt: Date.now() }
            : b,
        )
        setBooks(updatedBooks)
      }
    },
    [book, bookId, books, setBooks, setCurrentCfi],
  )

  // --- goToCfi ---
  const goToCfi = useCallback(
    (cfi: string) => {
      // 切换到阅读模式
      setReaderMode('read')

      if (renditionRef.current) {
        // 清除旧高亮
        if (lastHighlightCfiRef.current) {
          try {
            renditionRef.current.annotations.remove(lastHighlightCfiRef.current, 'highlight')
          } catch {
            // 静默忽略清除错误
          }
          lastHighlightCfiRef.current = null
        }

        // 跳转到目标位置
        void renditionRef.current.display(cfi).then(() => {
          // 跳转完成后添加高亮（降级处理）
          try {
            renditionRef.current?.annotations.highlight(
              cfi,
              {},
              undefined,
              'immerse-citation-highlight',
              { fill: 'rgba(251, 191, 36, 0.3)', 'fill-opacity': '0.3' },
            )
            lastHighlightCfiRef.current = cfi
          } catch {
            // CFI 非 range 格式，降级为仅跳转不高亮
          }
        })
      }
    },
    [setReaderMode],
  )

  // --- 监听 pendingCitationCfi 变化触发跳转 ---
  useEffect(() => {
    if (
      pendingCitationCfi &&
      readerMode === 'read' &&
      renditionRef.current
    ) {
      goToCfi(pendingCitationCfi)
      setPendingCitationCfi(null)
    }
  }, [pendingCitationCfi, readerMode, goToCfi, setPendingCitationCfi])

  return {
    blobUrl,
    loading,
    error,
    location,
    setLocation,
    renditionRef,
    goToCfi,
    handleLocationChanged,
  }
}
