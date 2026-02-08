import { createBrowserRouter, Navigate } from 'react-router-dom'
import { BookshelfPage } from '@/features/bookshelf/BookshelfPage'
import { ReaderPage } from '@/features/reader/ReaderPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/bookshelf" replace />
  },
  {
    path: '/bookshelf',
    element: <BookshelfPage />
  },
  {
    path: '/reader/:id',
    element: <ReaderPage />
  }
])
