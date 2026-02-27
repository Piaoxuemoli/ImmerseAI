import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/shared/store'

/**
 * useReader — 文本/Markdown 阅读器核心 Hook
 *
 * 职责：
 * 1. 通过 IPC (MCP readFile) 加载 .md/.txt → 文本内容
 * 2. 管理 loading / error 状态
 * 3. 管理段落索引/偏移并持久化到 Book.lastReadParagraphIndex
 * 4. 暴露 goToParagraph 方法
 */
export function useReader(bookId: string) {
  const books = useStore((s) => s.books)
  const setBooks = useStore((s) => s.setBooks)
  const setCurrentParagraphIndex = useStore((s) => s.setCurrentParagraphIndex)
  const setCurrentOffset = useStore((s) => s.setCurrentOffset)
  const setReaderMode = useStore((s) => s.setReaderMode)
  const pendingCitationParagraphIndex = useStore((s) => s.pendingCitationParagraphIndex)
  const setPendingCitationParagraphIndex = useStore((s) => s.setPendingCitationParagraphIndex)
  const setPendingCitationOffset = useStore((s) => s.setPendingCitationOffset)
  const readerMode = useStore((s) => s.readerMode)

  const book = books.find((b) => b.id === bookId)

  // --- State ---
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 阅读进度：从 Book.lastReadParagraphIndex 恢复
  const [paragraphIndex, setParagraphIndex] = useState<number>(
    book?.lastReadParagraphIndex ?? 0,
  )

  // --- 文本加载 ---
  useEffect(() => {
    if (!book) {
      setError('书籍不存在')
      setLoading(false)
      return
    }

    let cancelled = false

    const loadText = async () => {
      try {
        setLoading(true)
        setError(null)

        const arrayBuffer = await window.electronAPI.mcp.readFile(book.path)
        if (cancelled) return

        const decoder = new TextDecoder('utf-8')
        const text = decoder.decode(arrayBuffer)
        setContent(text)
      } catch (err) {
        if (!cancelled) {
          setError(String(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadText()

    return () => {
      cancelled = true
    }
  }, [book])

  // --- 进度变化回调 ---
  const handleProgressChange = useCallback(
    (newParagraphIndex: number, newOffset: number) => {
      setParagraphIndex(newParagraphIndex)
      setCurrentParagraphIndex(newParagraphIndex)
      setCurrentOffset(newOffset)

      // 持久化到 Book.lastReadParagraphIndex
      if (book) {
        const updatedBooks = books.map((b) =>
          b.id === bookId
            ? { ...b, lastReadParagraphIndex: newParagraphIndex, lastReadOffset: newOffset, lastReadAt: Date.now() }
            : b,
        )
        setBooks(updatedBooks)
      }
    },
    [book, bookId, books, setBooks, setCurrentParagraphIndex, setCurrentOffset],
  )

  // --- goToParagraph ---
  const goToParagraph = useCallback(
    (index: number) => {
      setReaderMode('read')
      setParagraphIndex(index)
      setCurrentParagraphIndex(index)
    },
    [setReaderMode, setCurrentParagraphIndex],
  )

  // --- 监听 pendingCitationParagraphIndex 变化触发跳转 ---
  useEffect(() => {
    if (
      pendingCitationParagraphIndex !== null &&
      readerMode === 'read'
    ) {
      goToParagraph(pendingCitationParagraphIndex)
      setPendingCitationParagraphIndex(null)
      setPendingCitationOffset(null)
    }
  }, [pendingCitationParagraphIndex, readerMode, goToParagraph, setPendingCitationParagraphIndex, setPendingCitationOffset])

  return {
    content,
    loading,
    error,
    paragraphIndex,
    goToParagraph,
    handleProgressChange,
  }
}
