/**
 * 新版 BookGrid 组件 - Stitch 设计风格
 *
 * 响应式 5 列网格布局
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-6">
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
