import type { Book } from '@/shared/types'

const COVER_COLORS = [
  { bg: 'bg-slate-700', text: 'text-white', border: 'border-slate-600' },
  { bg: 'bg-red-900', text: 'text-red-100', border: 'border-red-800' },
  { bg: 'bg-emerald-800', text: 'text-emerald-100', border: 'border-emerald-700' },
  { bg: 'bg-amber-800', text: 'text-amber-100', border: 'border-amber-700' },
  { bg: 'bg-sky-900', text: 'text-sky-100', border: 'border-sky-800' },
  { bg: 'bg-violet-900', text: 'text-violet-100', border: 'border-violet-800' },
]

interface BookCardProps {
  book: Book
  index: number
  onClick?: () => void
}

export function BookCard({ book, index, onClick }: BookCardProps) {
  const cover = COVER_COLORS[index % COVER_COLORS.length]

  return (
    <div
      className="cursor-pointer rounded-lg border border-border bg-background transition-all duration-200 hover:scale-[1.03] hover:shadow-md"
      onClick={onClick}
    >
      {/* 封面 */}
      <div
        className={`${cover.bg} ${cover.border} flex aspect-[3/4] items-center justify-center rounded-t-lg border-b px-2`}
      >
        <span className={`text-center text-xs font-semibold leading-tight ${cover.text} line-clamp-4`}>
          {book.title}
        </span>
      </div>

      {/* 书名 */}
      <div className="px-2 py-1.5">
        <p className="truncate text-xs font-medium text-foreground">
          {book.title}
        </p>
      </div>
    </div>
  )
}
