import { Settings, FilePlus, RefreshCw, Sun, Moon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useStore } from '@/shared/store'

interface TopBarProps {
  onSettingsClick?: () => void
  onImportClick?: () => void
  onRefreshClick?: () => void
  isRefreshing?: boolean
}

export function TopBar({ onSettingsClick, onImportClick, onRefreshClick, isRefreshing }: TopBarProps) {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 min-w-0">
      {/* Logo */}
      <h1 className="min-w-0 truncate text-xl font-semibold text-foreground pr-2">ImmerseAI</h1>

      {/* Action Buttons */}
      <div className="flex shrink-0 items-center gap-1">
        {/* 明暗主题切换 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Moon className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRefreshClick}
          disabled={isRefreshing}
          title="刷新书架"
        >
          <RefreshCw className={cn('h-5 w-5 text-muted-foreground', isRefreshing && 'animate-spin')} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onSettingsClick}>
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onImportClick} disabled={!onImportClick} title="导入书籍到当前文件夹">
          <FilePlus className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  )
}
