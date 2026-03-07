import type { Book } from '@/shared/types'

const COVER_COLORS = [
  'bg-slate-700',
  'bg-red-900',
  'bg-emerald-800',
  'bg-amber-800',
  'bg-sky-900',
  'bg-violet-900',
]

interface BookCardProps {
  book: Book
  index: number
  onClick?: () => void
}

export function BookCard({ book, index, onClick }: BookCardProps) {
  const coverColor = COVER_COLORS[index % COVER_COLORS.length]

  return (
    <div
      className="cursor-pointer rounded-lg border border-slate-200 bg-white transition-all duration-200 hover:scale-[1.03] hover:shadow-md"
      onClick={onClick}
    >
      {/* 封面 — 缩小为 3:4 比例 */}
      <div
        className={`${coverColor} flex aspect-[3/4] items-center justify-center rounded-t-lg px-2`}
      >
        <span className="text-center text-xs font-semibold leading-tight text-white line-clamp-4">
          {book.title}
        </span>
      </div>

      {/* 书名（不显示作者） */}
      <div className="px-2 py-1.5">
        <p className="truncate text-xs font-medium text-slate-800">
          {book.title}
        </p>
      </div>
    </div>
  )
}
