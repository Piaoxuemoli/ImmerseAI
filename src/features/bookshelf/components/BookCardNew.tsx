/**
 * BookCard 组件 - 紧凑文字信息卡片
 *
 * 特点：
 * - 无封面，纯文字信息
 * - 显示：书名、格式(MD/TXT)、阅读进度、RAG状态、上次阅读时间
 * - framer-motion 动效：hover 高亮、入场弹跳
 * - 支持删除按钮（hover 显示）
 */

import { forwardRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, FileText, Trash2 } from 'lucide-react'
import type { Book } from '@/shared/types'

interface BookCardNewProps {
  book: Book
  onClick: () => void
  onDelete?: (book: Book, rect: DOMRect) => void
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}月前`
  return `${Math.floor(days / 365)}年前`
}

function getFileFormat(path: string): 'MD' | 'TXT' | '' {
  if (path.endsWith('.md')) return 'MD'
  if (path.endsWith('.txt')) return 'TXT'
  return ''
}

export const BookCardNew = forwardRef<HTMLButtonElement, BookCardNewProps>(
  function BookCardNew({ book, onClick, onDelete }, ref) {
    const [isHovered, setIsHovered] = useState(false)

    const format = getFileFormat(book.path)
    const hasProgress = book.lastReadAt && book.lastReadParagraphIndex !== undefined
    const progressPercent = hasProgress
      ? Math.min(100, ((book.lastReadParagraphIndex || 0) / Math.max(1, book.chunkCount || 1)) * 100)
      : 0

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!ref || typeof ref === 'function' || !onDelete) return
        const element = ref as React.RefObject<HTMLButtonElement>
        const rect = element.getBoundingClientRect()
        onDelete(book, rect)
      },
      [book, onDelete, ref]
    )

    return (
      <motion.button
        ref={ref}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative w-full text-left bg-card rounded-lg border border-border p-3 shadow-sm cursor-pointer focus-visible:ring-2 focus-visible:ring-primary overflow-visible"
        whileHover={{
          scale: 1.04,
          y: -6,
          boxShadow: "0 0 24px 6px rgba(99, 102, 241, 0.25)",
          borderColor: "hsl(238, 84%, 67%)",
          transition: { duration: 0.2, ease: "easeOut" }
        }}
        initial={{ x: "100vw", y: -100, opacity: 0, scale: 0.8 }}
        animate={{
          x: 0,
          y: [0, -20, 0, -10, 0],
          opacity: 1,
          scale: 1,
          transition: {
            duration: 0.8,
            times: [0, 0.3, 0.5, 0.7, 1],
            ease: "easeOut"
          }
        }}
      >
        {/* 删除按钮 - hover 时显示，使用 div 避免嵌套 button */}
        {onDelete && (
          <motion.div
            role="button"
            tabIndex={0}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={handleDelete}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDelete(e as unknown as React.MouseEvent) }}
            className="absolute top-2 left-2 p-1.5 rounded-md bg-destructive/90 text-destructive-foreground hover:bg-destructive transition-colors z-10 cursor-pointer"
            title="删除书籍"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.div>
        )}

      {/* 头部：书名 + 格式标签 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight flex-1">
          {book.title}
        </h3>
        {format && (
          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {format}
          </span>
        )}
      </div>

      {/* RAG 状态 */}
      <div className="flex items-center gap-1.5 mb-2">
        {book.isIndexed ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        )}
        <span className={`text-xs ${book.isIndexed ? 'text-success' : 'text-muted-foreground/50'}`}>
          {book.isIndexed ? 'RAG已完成' : '未索引'}
        </span>
      </div>

      {/* 阅读进度条 */}
      {hasProgress && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>阅读中</span>
            <span>{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* 上次阅读时间 */}
      {book.lastReadAt && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <FileText className="w-3 h-3" />
          <span>{formatRelativeTime(book.lastReadAt)}</span>
        </div>
      )}
    </motion.button>
    )
  }
)
