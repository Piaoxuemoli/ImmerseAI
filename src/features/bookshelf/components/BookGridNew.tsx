/**
 * BookGrid 组件
 *
 * 响应式网格布局，适配紧凑型 BookCard
 */

import type { Book } from '@/shared/types'
import { BookCardNew } from './BookCardNew'

interface BookGridNewProps {
  books: Book[]
  onBookClick: (bookId: string) => void
}

export function BookGridNew({ books, onBookClick }: BookGridNewProps) {
  if (books.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
      {books.map((book) => (
        <BookCardNew
          key={book.id}
          book={book}
          onClick={() => onBookClick(book.id)}
        />
      ))}
    </div>
  )
}
