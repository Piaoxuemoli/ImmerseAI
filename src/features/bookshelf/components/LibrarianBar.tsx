/**
 * LibrarianBar 组件
 *
 * 书架页面底部的 Agent 交互入口
 * - 输入框接收用户自然语言指令
 * - 历史记录面板管理操作历史
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { ArrowUp, History, Trash2, X, Loader2 } from 'lucide-react'
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
  const historyRef = useRef<HTMLDivElement>(null)

  const {
    history,
    isExecuting,
    pendingDelete,
    executeCommand,
    confirmDelete,
    cancelDelete,
    clearHistory,
    lastMessage,
  } = useLibrarian(files, {
    ...(onCommandSuccess && { onCommandSuccess }),
    ...(rootFolders && { rootFolders }),
  })

  // 点击历史面板外部关闭
  useEffect(() => {
    if (!showHistory) return

    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        // 检查是否点击的是历史按钮本身
        const historyButton = document.getElementById('history-toggle-btn')
        if (historyButton && historyButton.contains(e.target as Node)) return
        setShowHistory(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHistory])

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
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
        {/* 最后消息提示 */}
        {lastMessage && (
          <div className="mx-auto max-w-7xl px-6 pt-2">
            <div className="text-sm text-foreground bg-muted rounded-md px-3 py-2">
              {lastMessage}
            </div>
          </div>
        )}

        {/* 输入区域 */}
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          {/* 历史记录按钮 */}
          <Button
            id="history-toggle-btn"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground relative"
            onClick={() => setShowHistory(!showHistory)}
            aria-label={showHistory ? '隐藏历史' : '显示历史'}
            title="操作历史"
          >
            {history.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {history.length > 9 ? '9+' : history.length}
              </span>
            )}
            <History className="h-5 w-5" />
          </Button>

          {/* 输入框 */}
          <Input
            placeholder="输入指令：列目录、创建文件夹、删除文件夹、移动书籍..."
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

      {/* 历史记录面板 - 浮动在左下角 */}
      {showHistory && (
        <div
          ref={historyRef}
          className="fixed bottom-20 left-4 z-50 w-80 max-h-96 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
        >
          {/* 面板头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <span className="text-sm font-medium text-foreground">
              操作历史 ({history.length})
            </span>
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  清空
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(false)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 历史列表 */}
          <div className="overflow-y-auto max-h-72">
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                暂无操作历史
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {history
                  .slice()
                  .reverse()
                  .map((op) => (
                    <AgentHistoryItem key={op.id} operation={op} />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

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
