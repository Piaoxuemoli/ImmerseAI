/**
 * LibrarianBar 组件
 *
 * 书架页面底部的 Agent 交互入口
 * - 输入框接收用户自然语言指令
 * - 显示操作历史记录
 * - 集成删除确认弹窗
 */

import { useState, useCallback } from 'react'
import { ArrowUp, History, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import type { BookFile } from '@/shared/types'
import { useLibrarian } from '../hooks/useLibrarian'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { AgentHistoryItem } from './AgentHistoryItem'

interface LibrarianBarProps {
  files: BookFile[]
  rootFolders?: BookFile[]
  onCommandSuccess?: () => Promise<void> | void
}

export function LibrarianBar({ files, rootFolders, onCommandSuccess }: LibrarianBarProps) {
  const [inputValue, setInputValue] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const {
    history,
    isExecuting,
    pendingDelete,
    executeCommand,
    confirmDelete,
    cancelDelete,
    clearHistory,
    lastMessage,
  } = useLibrarian(files, { onCommandSuccess, rootFolders })

  /**
   * 处理发送命令
   */
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isExecuting) return

    const command = inputValue.trim()
    setInputValue('')
    await executeCommand(command)
  }, [inputValue, isExecuting, executeCommand])

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur-sm">
        {/* 历史记录折叠面板 */}
        {showHistory && history.length > 0 && (
          <div className="mx-auto max-w-7xl border-b border-slate-200 px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">
                操作历史 ({history.length}/10)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                清空
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history
                .slice()
                .reverse()
                .map((op) => (
                  <AgentHistoryItem key={op.id} operation={op} />
                ))}
            </div>
          </div>
        )}

        {/* 最后消息提示 */}
        {lastMessage && (
          <div className="mx-auto max-w-7xl px-6 py-2">
            <div className="text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-2">
              {lastMessage}
            </div>
          </div>
        )}

        {/* 输入区域 */}
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          {/* 历史记录按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-500 hover:text-slate-700"
            onClick={() => setShowHistory(!showHistory)}
            title={showHistory ? '隐藏历史' : '显示历史'}
          >
            {history.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                {history.length}
              </span>
            )}
            <History className="h-4 w-4" />
            {showHistory ? (
              <ChevronDown className="h-3 w-3 ml-0.5" />
            ) : (
              <ChevronUp className="h-3 w-3 ml-0.5" />
            )}
          </Button>

          {/* 输入框 */}
          <Input
            placeholder="输入指令：列目录、创建文件夹、删除文件夹、移动书籍（使用路径）..."
            className="flex-1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
          />

          {/* 发送按钮 */}
          <Button
            variant="default"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={handleSend}
            disabled={isExecuting || !inputValue.trim()}
          >
            {isExecuting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <ConfirmDeleteDialog
        open={!!pendingDelete}
        fileName={pendingDelete?.fileName || ''}
        filePath={pendingDelete?.path || ''}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isDeleting={isExecuting}
      />
    </>
  )
}
