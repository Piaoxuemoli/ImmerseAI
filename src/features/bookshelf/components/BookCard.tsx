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
      className="cursor-pointer rounded-lg border border-slate-200 transition-transform duration-200 hover:scale-[1.03]"
      onClick={onClick}
    >
      {/* Cover */}
      <div
        className={`${coverColor} flex aspect-[2/3] items-center justify-center rounded-t-lg px-3`}
      >
        <span className="text-center text-sm font-semibold text-white">
          {book.title}
        </span>
      </div>

      {/* Info */}
      <div className="px-3 py-2">
        <p className="truncate text-sm font-semibold text-slate-900">
          {book.title}
        </p>
        <p className="truncate text-xs text-slate-500">
          {book.author}
        </p>
      </div>
    </div>
  )
}
