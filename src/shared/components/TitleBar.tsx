/**
 * TitleBar - 自定义窗口标题栏
 *
 * 特性：
 * - 磨砂玻璃效果（backdrop-filter: blur）
 * - 可拖拽区域（窗口移动）
 * - 窗口控制按钮（最小化、最大化/还原、关闭）
 * - 主题切换按钮（明/暗）
 */

import { useState, useEffect } from 'react'
import { Minus, Square, X, Maximize2, Sun, Moon } from 'lucide-react'
import { useStore } from '@/shared/store'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)

  useEffect(() => {
    // 初始化最大化状态
    window.windowControl.isMaximized().then(setIsMaximized)

    // 监听窗口最大化状态变化
    const unsubscribe = window.windowControl.onMaximizeChange(setIsMaximized)
    return unsubscribe
  }, [])

  const handleMinimize = () => {
    window.windowControl.minimize()
  }

  const handleMaximize = () => {
    window.windowControl.maximize()
  }

  const handleClose = () => {
    window.windowControl.close()
  }

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-9 flex items-center justify-between px-3 select-none"
      style={{
        // 磨砂玻璃效果 - 根据主题变化
        backgroundColor: theme === 'dark'
          ? 'rgba(30, 30, 30, 0.75)'
          : 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: theme === 'dark'
          ? '1px solid rgba(255, 255, 255, 0.1)'
          : '1px solid rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* 可拖拽区域 */}
      <div
        className="flex-1 flex items-center h-full"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* 应用图标 */}
        <div className="flex items-center gap-2 ml-1">
          <div
            className="w-4 h-4 rounded-md flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            <span className="text-white text-[8px] font-bold">IA</span>
          </div>
          <span className="text-xs font-medium text-foreground/80">ImmerseAI</span>
        </div>
      </div>

      {/* 右侧控制按钮 */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* 主题切换 */}
        <button
          onClick={handleThemeToggle}
          className="w-11 h-full flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors"
          title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-foreground/70" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-foreground/70" />
          )}
        </button>

        {/* 最小化 */}
        <button
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors"
          title="最小化"
        >
          <Minus className="w-3.5 h-3.5 text-foreground/70" />
        </button>

        {/* 最大化/还原 */}
        <button
          onClick={handleMaximize}
          className="w-11 h-full flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors"
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? (
            <Maximize2 className="w-3.5 h-3.5 text-foreground/70" />
          ) : (
            <Square className="w-3 h-3 text-foreground/70" />
          )}
        </button>

        {/* 关闭 */}
        <button
          onClick={handleClose}
          className="w-11 h-full flex items-center justify-center hover:bg-red-500 hover:text-white active:bg-red-600 transition-colors"
          title="关闭"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
