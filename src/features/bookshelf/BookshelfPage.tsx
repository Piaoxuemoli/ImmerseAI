import type { Book } from '@/shared/types'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
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
  return (
    <div className="min-h-screen bg-white">
      <TopBar />
      <ScrollArea className="h-[calc(100vh-52px)]">
        <div className="mx-auto max-w-7xl pb-20">
          <BookGrid books={MOCK_BOOKS} />
        </div>
      </ScrollArea>
      <LibrarianBar />
    </div>
  )
}
