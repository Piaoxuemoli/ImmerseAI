import React, { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-semibold text-foreground mt-8 mb-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold text-foreground mt-6 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-foreground mt-4 mb-2">{children}</h3>
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
  content: string
  bookPath: string
  initialParagraphIndex?: number
  _initialOffset?: number
  onProgressChange?: (paragraphIndex: number, offset: number) => void
  _onJumpRequest?: (paragraphIndex: number) => void
}

export const TextViewer: React.FC<TextViewerProps> = ({
  content,
  bookPath,
  initialParagraphIndex,
  _initialOffset,
  onProgressChange,
  _onJumpRequest,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const isMarkdown = bookPath.endsWith('.md')

  useEffect(() => {
    if (initialParagraphIndex !== undefined && containerRef.current) {
      const paragraphs = containerRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6')
      const targetParagraph = paragraphs[initialParagraphIndex]
      if (targetParagraph) {
        targetParagraph.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [initialParagraphIndex, content])

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || !onProgressChange) return

      const paragraphs = containerRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6')
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
  }, [onProgressChange, content])

  if (isMarkdown) {
    return (
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-8 py-6 bg-background text-foreground"
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          lineHeight: '1.8',
          fontSize: '18px',
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
      className="h-full overflow-y-auto px-8 py-6 bg-background text-foreground"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        lineHeight: '1.8',
        fontSize: '18px',
        whiteSpace: 'pre-wrap',
      }}
    >
      {content}
    </div>
  )
}
