import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/shared/store'
import { WINDOWS_ABSOLUTE_PATH_RE } from '@/shared/utils/path'
import { contentCache } from '../utils/contentCache'

/**
 * useReader — 文本/Markdown 阅读器核心 Hook
 *
 * 职责：
 * 1. 通过 IPC (MCP readFile) 加载 .md/.txt → 文本内容
 * 2. 管理 loading / error 状态
 * 3. 管理段落索引/偏移并持久化到 Book.lastReadParagraphIndex
 * 4. 暴露 goToParagraph 方法
 * 5. 渐进加载：先显示最后阅读位置附近内容，后台加载全文
 * 6. 内容缓存：加速二次加载，文件删除时自动失效
 */
export function useReader(bookId: string) {
  const books = useStore((s) => s.books)
  const bookshelfRootPath = useStore((s) => s.bookshelfRootPath)
  const setBooks = useStore((s) => s.setBooks)
  const setCurrentParagraphIndex = useStore((s) => s.setCurrentParagraphIndex)
  const setCurrentOffset = useStore((s) => s.setCurrentOffset)
  const setReaderMode = useStore((s) => s.setReaderMode)

  const book = books.find((b) => b.id === bookId)
  const bookPath = book?.path ?? ''

  // --- State ---
  const [content, setContent] = useState<string | null>(null)
  const [partialContent, setPartialContent] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 阅读进度：从 Book.lastReadParagraphIndex 恢复
  const [paragraphIndex, setParagraphIndex] = useState<number>(
    book?.lastReadParagraphIndex ?? 0,
  )

  // --- 渐进式文本加载 ---
  useEffect(() => {
    if (!book || !bookPath) {
      setError('书籍不存在')
      setLoading(false)
      return
    }

    let cancelled = false
    let isActive = true

    const splitToParagraphs = (text: string): string[] => {
      // 按双换行分割段落
      return text.split(/\n\n+/).filter(p => p.trim().length > 0)
    }

    const loadProgressive = async () => {
      // 路径解析放外面声明，catch 块需要访问
      let resolvedBookPath = ''
      const isAbsolutePath = WINDOWS_ABSOLUTE_PATH_RE.test(bookPath) || bookPath.startsWith('/')
      const normalizedRoot = bookshelfRootPath.replace(/[\\/]+$/, '')
      const normalizedBookPath = bookPath.replace(/^[\\/]+/, '')
      resolvedBookPath =
        isAbsolutePath || !normalizedRoot
          ? bookPath
          : `${normalizedRoot}/${normalizedBookPath}`

      try {
        setLoading(true)
        setError(null)
        setPartialContent(null)
        setLoadProgress(0)

        // 尝试从缓存获取
        let fullText = contentCache.get(bookId, resolvedBookPath)

        if (!fullText) {
          // 缓存未命中，调用 MCP 读取文件
          const arrayBuffer = await window.electronAPI.mcp.readFile(resolvedBookPath)
          if (cancelled || !isActive) return

          const decoder = new TextDecoder('utf-8')
          fullText = decoder.decode(arrayBuffer)

          // 存入缓存
          contentCache.set(bookId, resolvedBookPath, fullText)
        }

        const paragraphs = splitToParagraphs(fullText)

        if (cancelled || !isActive) return

        // 计算起始渲染位置：最后阅读位置附近 ± 缓冲段落
        const lastReadIdx = book?.lastReadParagraphIndex ?? 0
        const bufferSize = 10 // 上下各10段
        const startIdx = Math.max(0, lastReadIdx - bufferSize)
        const endIdx = Math.min(paragraphs.length, lastReadIdx + bufferSize)

        // 第1步：立即渲染最后阅读位置附近
        const initialContent = paragraphs.slice(startIdx, endIdx).join('\n\n')
        setPartialContent(initialContent)
        setParagraphIndex(lastReadIdx)
        setLoadProgress(10)
        setLoading(false) // 用户可阅读了

        if (cancelled || !isActive) return

        // 第2步：后台渐进加载全文
        const BATCH_SIZE = 100
        for (let i = 0; i < paragraphs.length; i += BATCH_SIZE) {
          if (cancelled || !isActive) return

          // 让出主线程
          await new Promise(resolve => {
            if ('requestIdleCallback' in window) {
              requestIdleCallback(resolve, { timeout: 100 })
            } else {
              setTimeout(resolve, 0)
            }
          })

          if (!isActive) return

          // 更新进度（去除已加载部分）
          const progress = Math.min(95, Math.floor((i / paragraphs.length) * 100) + 10)
          setLoadProgress(progress)
        }

        if (!isActive) return

        // 第3步：全文加载完成
        setContent(fullText)
        setPartialContent(fullText)
        setLoadProgress(100)
      } catch (err) {
        if (!cancelled && isActive) {
          // 文件读取失败，清除缓存
          contentCache.delete(bookId, resolvedBookPath)
          setError(String(err))
          setLoading(false)
        }
      }
    }

    void loadProgressive()

    return () => {
      cancelled = true
      isActive = false
    }
  }, [bookId, bookPath, bookshelfRootPath, book?.lastReadParagraphIndex])

  // --- 进度变化回调 ---
  const handleProgressChange = useCallback(
    (newParagraphIndex: number, newOffset: number) => {
      // 未变化时不写入 store，避免触发不必要的重渲染和重复 readFile
      const prevParagraphIndex = book?.lastReadParagraphIndex ?? 0
      const prevOffset = book?.lastReadOffset ?? 0
      const hasProgressChanged =
        prevParagraphIndex !== newParagraphIndex || prevOffset !== newOffset

      setParagraphIndex(newParagraphIndex)
      setCurrentParagraphIndex(newParagraphIndex)
      setCurrentOffset(newOffset)

      // 持久化到 Book.lastReadParagraphIndex
      if (book && hasProgressChanged) {
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

  // 用 ref 持有最新的 goToParagraph，避免 subscribe 闭包陈旧
  const goToParagraphRef = useRef(goToParagraph)
  goToParagraphRef.current = goToParagraph

  // --- 监听 pendingCitationParagraphIndex 变化触发跳转 ---
  useEffect(() => {
    return useStore.subscribe((state) => {
      const { pendingCitationParagraphIndex, readerMode } = state
      if (pendingCitationParagraphIndex !== null && readerMode === 'read') {
        goToParagraphRef.current(pendingCitationParagraphIndex)
        useStore.getState().setPendingCitationParagraphIndex(null)
        useStore.getState().setPendingCitationOffset(null)
      }
    })
  }, [])

  return {
    content: partialContent ?? content, // 优先显示渐进加载的部分
    fullContent: content,              // 全文（可能未加载完）
    loading,
    error,
    loadProgress,
    paragraphIndex,
    goToParagraph,
    handleProgressChange,
  }
}
