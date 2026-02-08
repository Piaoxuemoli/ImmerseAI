import type { Book } from '@/shared/types'
import { BookCard } from './BookCard'

interface BookGridProps {
  books: Book[]
}

export function BookGrid({ books }: BookGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6 px-6 py-6">
      {books.map((book, index) => (
        <BookCard
          key={book.id}
          book={book}
          index={index}
          onClick={() => {}}
        />
      ))}
    </div>
  )
}
