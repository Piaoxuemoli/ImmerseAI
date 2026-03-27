/**
 * 删除确认弹窗组件
 *
 * 使用 shadcn/ui Dialog 实现删除操作的二次确认
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDeleteDialogProps {
  open: boolean
  fileName: string
  filePath: string
  onConfirm: () => void
  onCancel: () => void
  isDeleting?: boolean
}

export function ConfirmDeleteDialog({
  open,
  fileName,
  filePath,
  onConfirm,
  onCancel,
  isDeleting = false,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            确认删除文件夹
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-2">
              <p>确定要删除以下文件夹吗？</p>
              <p className="font-medium text-foreground">{fileName}</p>
              <p className="font-mono text-xs text-muted-foreground break-all">{filePath}</p>
              <p className="text-red-500 font-medium mt-2">⚠️ 此操作不可撤销</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? '删除中...' : '确认删除'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
