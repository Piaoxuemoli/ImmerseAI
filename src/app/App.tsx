import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ThemeProvider } from '@/shared/components/ThemeProvider'

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}
