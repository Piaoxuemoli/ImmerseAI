import React, { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mt-8 mb-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl sm:text-2xl font-semibold text-foreground mt-6 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg sm:text-xl font-semibold text-foreground mt-4 mb-2">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-4 text-foreground">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 text-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 text-foreground">{children}</ol>,
  code: ({ className, children }) => {
    const isInline = !className
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
          {children}
        </code>
      )
    }
    return (
      <code className="block bg-accent text-accent-foreground p-4 rounded-lg overflow-x-auto font-mono text-sm mb-4">
        {children}
      </code>
    )
  },
}

interface TextViewerProps {
  content: string | null
  bookPath: string
  initialParagraphIndex?: number
  _initialOffset?: number
  onProgressChange?: (paragraphIndex: number, offset: number) => void
  _onJumpRequest?: (paragraphIndex: number) => void
  loadProgress?: number  // 0-100, undefined 表示非渐进加载模式
}

export const TextViewer: React.FC<TextViewerProps> = ({
  content,
  bookPath,
  initialParagraphIndex,
  _initialOffset,
  onProgressChange,
  _onJumpRequest,
  loadProgress,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  const isMarkdown = bookPath.endsWith('.md')

  // 初始化滚动位置 - 仅首次渲染内容时执行
  useEffect(() => {
    if (hasScrolledRef.current || !content || initialParagraphIndex === undefined) return
    hasScrolledRef.current = true

    // 等待 DOM 更新后再滚动
    requestAnimationFrame(() => {
      if (!containerRef.current) return
      const paragraphs = containerRef.current.querySelectorAll(
        'p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, li'
      )
      const targetParagraph = paragraphs[initialParagraphIndex]
      if (targetParagraph) {
        targetParagraph.scrollIntoView({ behavior: 'auto', block: 'start' })
      }
    })
  }, [content, initialParagraphIndex])

  // 书籍切换时重置滚动标记
  useEffect(() => {
    hasScrolledRef.current = false
  }, [initialParagraphIndex])

  // 滚动监听进度变化
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || !onProgressChange) return

      const paragraphs = containerRef.current.querySelectorAll(
        'p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, li'
      )
      const containerTop = containerRef.current.getBoundingClientRect().top

      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i] as HTMLElement
        const rect = paragraph.getBoundingClientRect()
        if (rect.top >= containerTop && rect.top <= containerTop + 100) {
          onProgressChange(i, 0)
          break
        }
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [onProgressChange])

  // 加载状态 - 骨架屏（所有 hooks 调用之后）
  if (!content) {
    return (
      <div className="h-full overflow-hidden px-8 py-6 bg-background">
        <div className="max-w-3xl mx-auto animate-pulse">
          {/* 加载进度指示 */}
          {loadProgress !== undefined && (
            <div className="mb-6 flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {loadProgress < 100 ? `加载中 ${loadProgress}%` : '加载完成'}
              </span>
            </div>
          )}
          {/* 骨架屏 */}
          <div className="h-7 bg-border rounded-md w-3/5 mb-8" />
          {Array.from({ length: 3 }).map((_, gi) => (
            <div key={gi} className="mb-8 space-y-3">
              <div className="h-4 bg-border rounded w-full" />
              <div className="h-4 bg-border rounded w-full" />
              <div className="h-4 bg-border rounded w-5/6" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isMarkdown) {
    return (
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-8 py-6 bg-background text-foreground text-base sm:text-lg leading-relaxed sm:leading-loose"
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown components={MARKDOWN_COMPONENTS}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-8 py-6 bg-background text-foreground text-base sm:text-lg leading-relaxed sm:leading-loose"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 'var(--reading-font-size)',
        lineHeight: 'var(--reading-line-height)',
        whiteSpace: 'pre-wrap',
      }}
    >
      {content}
    </div>
  )
}
