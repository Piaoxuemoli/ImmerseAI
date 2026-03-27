/**
 * useLibrarian Hook
 *
 * 封装 Librarian Agent 的状态管理和 UI 交互
 */

import { useState, useCallback } from 'react'
import { useStore } from '@/shared/store'
import type { AgentOperation, BookFile } from '@/shared/types'
import {
  executeLibrarianCommand,
  executeDeleteFile,
  type AgentExecuteResult,
} from '../services/librarian-agent'

/**
 * 删除确认数据
 */
interface DeleteConfirmation {
  path: string
  fileName: string
}

/**
 * useLibrarian Hook 返回值
 */
export interface UseLibrarianReturn {
  /** 操作历史记录 */
  history: AgentOperation[]
  /** 是否正在执行命令 */
  isExecuting: boolean
  /** 当前待确认的删除操作 */
  pendingDelete: DeleteConfirmation | null
  /** 执行用户命令 */
  executeCommand: (userInput: string) => Promise<void>
  /** 确认删除操作 */
  confirmDelete: () => Promise<void>
  /** 取消删除操作 */
  cancelDelete: () => void
  /** 清空操作历史 */
  clearHistory: () => void
  /** 最后一次执行的消息 */
  lastMessage: string | null
}

interface UseLibrarianOptions {
  onCommandSuccess?: () => Promise<void> | void
  rootFolders?: BookFile[]
}

/**
 * Librarian Agent Hook
 *
 * @param files - 当前书架文件列表
 * @param options - 配置选项
 * @returns Hook 返回值
 */
export function useLibrarian(files: BookFile[], options: UseLibrarianOptions = {}): UseLibrarianReturn {
  const bookshelfRootPath = useStore((state) => state.bookshelfRootPath)
  const connectionStatus = useStore((state) => state.connectionStatus)
  const llmConfig = useStore((state) => state.llmConfig)
  const history = useStore((state) => state.agentHistory)
  const addAgentOperation = useStore((state) => state.addAgentOperation)
  const clearAgentHistory = useStore((state) => state.clearAgentHistory)
  const onCommandSuccess = options.onCommandSuccess
  const rootFolders = options.rootFolders ?? []

  const [isExecuting, setIsExecuting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DeleteConfirmation | null>(null)
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const [pendingOperation, setPendingOperation] = useState<Partial<AgentOperation> | null>(null)

  /**
   * 执行用户命令
   */
  const executeCommand = useCallback(
    async (userInput: string) => {
      if (!userInput.trim()) {
        setLastMessage('请输入指令')
        return
      }

      if (connectionStatus !== 'connected') {
        setLastMessage('请先连接到 MCP 服务')
        return
      }

      setIsExecuting(true)
      setLastMessage(null)

      try {
        const result: AgentExecuteResult = await executeLibrarianCommand(
          userInput,
          bookshelfRootPath,
          files,
          llmConfig,
          rootFolders,
        )

        if (result.needsConfirmation && result.confirmationData) {
          // 删除操作需要确认
          setPendingDelete({
            path: result.confirmationData.path,
            fileName: result.confirmationData.fileName,
          })
          setPendingOperation(result.operation)
          setLastMessage(`确认删除文件夹：${result.confirmationData.fileName}？`)
        } else {
          // 其他操作直接记录结果
          if (result.operation.id) {
            addAgentOperation(result.operation as AgentOperation)
          }
          setLastMessage(result.message)
          if (result.success) {
            await onCommandSuccess?.()
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '执行命令失败'
        setLastMessage(errorMsg)
      } finally {
        setIsExecuting(false)
      }
    },
    [bookshelfRootPath, connectionStatus, files, llmConfig, rootFolders, addAgentOperation, onCommandSuccess],
  )

  /**
   * 确认删除操作
   */
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return

    setIsExecuting(true)
    const startTime = Date.now()

    try {
      const result = await executeDeleteFile(pendingDelete.path)

      // 记录操作结果
      const operation: AgentOperation = {
        id: pendingOperation?.id || crypto.randomUUID(),
        timestamp: pendingOperation?.timestamp || startTime,
        intent: 'delete_file',
        input: pendingOperation?.input || '',
        params: { path: pendingDelete.path },
        result: result.success ? 'success' : 'error',
        message: result.message,
        duration: Date.now() - (pendingOperation?.timestamp || startTime),
      }

      addAgentOperation(operation)
      setLastMessage(result.message)
      if (result.success) {
        await onCommandSuccess?.()
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '删除文件夹失败'
      setLastMessage(errorMsg)
    } finally {
      setPendingDelete(null)
      setPendingOperation(null)
      setIsExecuting(false)
    }
  }, [pendingDelete, pendingOperation, addAgentOperation, onCommandSuccess])

  /**
   * 取消删除操作
   */
  const cancelDelete = useCallback(() => {
    setPendingDelete(null)
    setPendingOperation(null)
    setLastMessage('已取消删除操作')
  }, [])

  /**
   * 清空操作历史
   */
  const clearHistory = useCallback(() => {
    clearAgentHistory()
    setLastMessage('已清空操作历史')
  }, [clearAgentHistory])

  return {
    history,
    isExecuting,
    pendingDelete,
    executeCommand,
    confirmDelete,
    cancelDelete,
    clearHistory,
    lastMessage,
  }
}
