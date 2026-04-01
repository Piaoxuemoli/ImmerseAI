/**
 * 新版 Sidebar 组件 - Stitch 设计风格
 *
 * 左侧文件夹导航栏
 * - 固定宽度 240px
 * - 可选中状态指示条
 * - 新建文件夹按钮
 */

import { FolderOpen, Plus } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import type { BookFile } from '@/shared/types'

interface SidebarNewProps {
  folders: BookFile[]
  activeFolderPath: string
  onFolderClick: (path: string) => void
  onCreateFolder: () => void
}

export function SidebarNew({
  folders,
  activeFolderPath,
  onFolderClick,
  onCreateFolder,
}: SidebarNewProps) {
  return (
    <aside className="w-48 shrink-0 bg-card border-r border-border flex flex-col h-full">
      {/* 文件夹列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {folders.map((folder) => {
            const isActive = folder.path === activeFolderPath
            return (
              <button
                key={folder.path}
                onClick={() => onFolderClick(folder.path)}
                className={`
                  relative w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                  transition-colors duration-150
                  ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted'
                  }
                `}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 新建文件夹按钮 */}
      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={onCreateFolder}
        >
          <Plus className="w-4 h-4" />
          <span>新建文件夹</span>
        </Button>
      </div>
    </aside>
  )
}
