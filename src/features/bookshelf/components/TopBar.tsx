import { Settings, FilePlus, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface TopBarProps {
  onSettingsClick?: () => void
  onImportClick?: () => void
  onRefreshClick?: () => void
  isRefreshing?: boolean
}

export function TopBar({ onSettingsClick, onImportClick, onRefreshClick, isRefreshing }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 min-w-0">
      {/* Logo */}
      <h1 className="min-w-0 truncate text-xl font-semibold text-slate-900 pr-2">ImmerseAI</h1>

      {/* Action Buttons — shrink-0 ensures icons never get squeezed */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefreshClick}
          disabled={isRefreshing}
          title="刷新书架"
        >
          <RefreshCw className={cn('h-5 w-5 text-slate-500', isRefreshing && 'animate-spin')} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onSettingsClick}>
          <Settings className="h-5 w-5 text-slate-500" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onImportClick} disabled={!onImportClick} title="导入书籍到当前文件夹">
          <FilePlus className="h-5 w-5 text-slate-500" />
        </Button>
      </div>
    </header>
  )
}
