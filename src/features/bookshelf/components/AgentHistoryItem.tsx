/**
 * Agent 操作历史项组件
 *
 * 显示单条操作记录，包括意图、状态、耗时等信息
 */

import type { AgentOperation } from '@/shared/types'
import { CheckCircle2, XCircle, FolderOpen, MoveRight, FolderPlus, Trash2, HelpCircle } from 'lucide-react'

interface AgentHistoryItemProps {
  operation: AgentOperation
}

/**
 * 根据意图获取图标
 */
function getIntentIcon(intent: AgentOperation['intent']) {
  switch (intent) {
    case 'list_files':
      return <FolderOpen className="h-4 w-4" />
    case 'move_file':
      return <MoveRight className="h-4 w-4" />
    case 'create_directory':
      return <FolderPlus className="h-4 w-4" />
    case 'delete_file':
      return <Trash2 className="h-4 w-4" />
    default:
      return <HelpCircle className="h-4 w-4" />
  }
}

/**
 * 根据意图获取中文描述
 */
function getIntentLabel(intent: AgentOperation['intent']) {
  switch (intent) {
    case 'list_files':
      return '列出文件'
    case 'move_file':
      return '移动文件'
    case 'create_directory':
      return '创建目录'
    case 'delete_file':
      return '删除文件'
    default:
      return '未知操作'
  }
}

/**
 * 格式化时间戳
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export function AgentHistoryItem({ operation }: AgentHistoryItemProps) {
  const isSuccess = operation.result === 'success'

  return (
    <div
      className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
        isSuccess
          ? 'bg-green-50 border border-green-200'
          : 'bg-red-50 border border-red-200'
      }`}
    >
      {/* 状态图标 */}
      <div className="flex-shrink-0 mt-0.5">
        {isSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-w-0">
        {/* 操作类型和时间 */}
        <div className="flex items-center gap-2 text-slate-600">
          {getIntentIcon(operation.intent)}
          <span className="font-medium">{getIntentLabel(operation.intent)}</span>
          <span className="text-slate-400">·</span>
          <span className="text-xs text-slate-400">{formatTime(operation.timestamp)}</span>
          <span className="text-xs text-slate-400">({operation.duration}ms)</span>
        </div>

        {/* 用户输入 */}
        <div className="mt-1 text-xs text-slate-500 truncate" title={operation.input}>
          "{operation.input}"
        </div>

        {/* 结果消息 */}
        <div
          className={`mt-1 text-xs truncate ${
            isSuccess ? 'text-green-700' : 'text-red-700'
          }`}
          title={operation.message}
        >
          {operation.message}
        </div>
      </div>
    </div>
  )
}
