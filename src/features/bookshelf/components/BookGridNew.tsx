/**
 * BookGrid 组件
 *
 * 响应式网格布局，适配紧凑型 BookCard
 * 支持 framer-motion 入场动画
 */

import { AnimatePresence } from 'framer-motion'
import type { Book } from '@/shared/types'
import { BookCardNew } from './BookCardNew'

interface BookGridNewProps {
  books: Book[]
  onBookClick: (bookId: string) => void
  onBookDelete?: (book: Book, rect: DOMRect) => void
}

export function BookGridNew({ books, onBookClick, onBookDelete }: BookGridNewProps) {
  if (books.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
      <AnimatePresence mode="popLayout">
        {books.map((book) => (
          <BookCardNew
            key={book.id}
            book={book}
            onClick={() => onBookClick(book.id)}
            onDelete={onBookDelete}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
