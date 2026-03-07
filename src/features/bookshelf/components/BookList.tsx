import { BookOpen } from 'lucide-react'
import type { Book } from '@/shared/types'

const COVER_COLORS = [
  'bg-slate-700',
  'bg-red-900',
  'bg-emerald-800',
  'bg-amber-800',
  'bg-sky-900',
  'bg-violet-900',
]

interface BookListProps {
  books: Book[]
  onBookClick?: (bookId: string) => void
}

export function BookList({ books, onBookClick }: BookListProps) {
  return (
    <div className="flex flex-col divide-y divide-slate-100 px-6 py-2">
      {books.map((book, index) => {
        const coverColor = COVER_COLORS[index % COVER_COLORS.length]
        const fileName = book.path.replace(/\\/g, '/').split('/').pop() ?? ''
        const lastRead = book.lastReadAt
          ? new Date(book.lastReadAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
          : null

        return (
          <button
            key={book.id}
            className="flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 rounded-md px-2 -mx-2 transition-colors"
            onClick={() => onBookClick?.(book.id)}
          >
            {/* 缩略封面 */}
            <div className={`${coverColor} flex h-10 w-8 shrink-0 items-center justify-center rounded`}>
              <BookOpen className="h-4 w-4 text-white/80" />
            </div>

            {/* 文字信息 */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{book.title}</p>
              <p className="truncate text-xs text-slate-400">{fileName}</p>
            </div>

            {/* 上次阅读时间 */}
            {lastRead && (
              <span className="shrink-0 text-xs text-slate-400">{lastRead}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
