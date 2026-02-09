import { useMemo } from 'react'
import type { Book, BookFile } from '@/shared/types'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { useStore } from '@/shared/store'
import { TopBar } from './components/TopBar'
import { BookGrid } from './components/BookGrid'
import { LibrarianBar } from './components/LibrarianBar'

const MOCK_BOOKS: Book[] = [
  { id: '1', title: '三体', author: '刘慈欣', path: '/books/santi.epub', isIndexed: false },
  { id: '2', title: '活着', author: '余华', path: '/books/huozhe.epub', isIndexed: false },
  { id: '3', title: '百年孤独', author: '加西亚·马尔克斯', path: '/books/bainian.epub', isIndexed: false },
  { id: '4', title: '1984', author: 'George Orwell', path: '/books/1984.epub', isIndexed: false },
  { id: '5', title: '小王子', author: 'Antoine de Saint-Exupéry', path: '/books/prince.epub', isIndexed: false },
  { id: '6', title: '人类简史', author: '尤瓦尔·赫拉利', path: '/books/sapiens.epub', isIndexed: false },
]

export function BookshelfPage() {
  const books = useStore((state) => state.books)

  // 将 books 转换为 BookFile 格式供 LibrarianBar 使用
  const bookFiles: BookFile[] = useMemo(() => {
    // 优先使用 store 中的实际书籍，fallback 到 mock 数据
    const sourceBooks = books.length > 0 ? books : MOCK_BOOKS
    return sourceBooks.map((book) => ({
      name: book.path.split('/').pop() || book.title,
      path: book.path,
      size: 0,
      type: 'epub' as const,
      lastModified: Date.now(),
    }))
  }, [books])

  return (
    <div className="min-h-screen bg-white">
      <TopBar />
      <ScrollArea className="h-[calc(100vh-52px)]">
        <div className="mx-auto max-w-7xl pb-20">
          <BookGrid books={books.length > 0 ? books : MOCK_BOOKS} />
        </div>
      </ScrollArea>
      <LibrarianBar files={bookFiles} />
    </div>
  )
}
