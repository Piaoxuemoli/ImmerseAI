/**
 * 新版 BookCard 组件 - Stitch 设计风格
 *
 * 特点：
 * - 更大的圆角 (12px)
 * - 轻微阴影 + hover 上浮效果
 * - 底部进度条显示阅读进度
 */

import { BookOpen } from 'lucide-react'
import type { Book } from '@/shared/types'

interface BookCardNewProps {
  book: Book
  onClick: () => void
}

export function BookCardNew({ book, onClick }: BookCardNewProps) {
  // 计算阅读进度
  const hasProgress = book.lastReadAt && book.lastReadParagraphIndex !== undefined
  const progressPercent = hasProgress ? Math.min(100, (book.lastReadParagraphIndex || 0) / 10) : 0
  const isComplete = book.isIndexed && !hasProgress

  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left bg-card rounded-xl overflow-hidden shadow-sm card-hover cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* 封面区域 */}
      <div className="aspect-[2/3] bg-muted relative overflow-hidden">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <BookOpen className="w-12 h-12 text-primary/40" />
          </div>
        )}

        {/* 完成后徽章 */}
        {isComplete && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-success/90 text-success-foreground text-[10px] font-medium">
            已完成
          </div>
        )}
      </div>

      {/* 信息区域 */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">
          {book.title}
        </h3>
        {book.author && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {book.author}
          </p>
        )}
      </div>

      {/* 进度条 */}
      {hasProgress && (
        <div className="px-3 pb-3">
          <div className="progress-reading">
            <div
              className="progress-reading-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            阅读中 · {progressPercent.toFixed(0)}%
          </p>
        </div>
      )}
    </button>
  )
}
