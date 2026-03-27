import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom'
import { BookshelfPage } from '@/features/bookshelf/BookshelfPage'
import { ReaderPage } from '@/features/reader/ReaderPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { PageTransitionLayout } from '@/shared/components/PageTransitionLayout'

const routes = [
  {
    element: <PageTransitionLayout />,
    children: [
      { path: '/', element: <Navigate to="/bookshelf" replace /> },
      { path: '/bookshelf', element: <BookshelfPage /> },
      { path: '/reader/:id', element: <ReaderPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/bookshelf" replace /> },
    ],
  },
]

const isFileProtocol =
  typeof window !== 'undefined' && window.location.protocol === 'file:'

export const router = isFileProtocol
  ? createHashRouter([...routes])
  : createBrowserRouter([...routes])
