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
        void renditionRef.current.display(cfi)
      }
    },
    [setReaderMode],
  )

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
