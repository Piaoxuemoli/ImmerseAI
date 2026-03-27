/**
 * NoteConfirmation — 笔记写入确认/错误卡片组件
 *
 * 在对话中展示笔记操作的结果：
 * - 成功：绿色卡片，显示标题和文件路径
 * - 失败：红色卡片，显示错误原因
 */

import { motion } from 'framer-motion'
import { FileText, AlertCircle } from 'lucide-react'

interface NoteConfirmationProps {
  success: boolean
  noteTitle?: string | undefined
  filePath?: string | undefined
  error?: string | undefined
}

export function NoteConfirmation({ success, noteTitle, filePath, error }: NoteConfirmationProps) {
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.08 }}
        className="rounded-lg border border-green-200 bg-green-50 p-3"
      >
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-green-700">
              笔记已保存
            </span>
            {noteTitle && (
              <span className="text-sm text-green-800">
                {noteTitle}
              </span>
            )}
            {filePath && (
              <span className="font-mono text-xs text-muted-foreground">
                {filePath}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.08 }}
      className="rounded-lg border border-red-200 bg-red-50 p-3"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-red-700">
            笔记保存失败
          </span>
          {error && (
            <span className="text-sm text-red-600">
              {error}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
