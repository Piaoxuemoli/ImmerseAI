import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ThemeProvider } from '@/shared/components/ThemeProvider'

export function App() {
  return (
    <ThemeProvider>
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        跳转到主内容
      </a>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}
