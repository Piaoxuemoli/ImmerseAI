import { useEffect, useRef } from 'react'
import { useStore } from '@/shared/store'

interface ThemeProviderProps {
  children: React.ReactNode
}

/**
 * 监听 Zustand store.theme，同步将 'dark' / '' class 写到 <html>。
 * 在首次渲染前从 localStorage 读取已持久化的主题，避免页面刷新时的闪烁。
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useStore((s) => s.theme)
  const initialized = useRef(false)

  // 初始化：从 localStorage 提前应用主题，防止 React hydrate 前白屏闪烁
  if (!initialized.current) {
    initialized.current = true
    try {
      const raw = localStorage.getItem('immerse-store')
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { theme?: string } }
        const saved = parsed?.state?.theme
        if (saved === 'dark') {
          document.documentElement.classList.add('dark')
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return <>{children}</>
}
