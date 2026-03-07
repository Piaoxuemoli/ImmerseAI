import { useEffect } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { usePersona } from '@/features/persona/hooks/usePersona'
import type { Persona } from '@/shared/types'

interface PersonaConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookId: string
  bookTitle: string
  existingPersona?: Persona | undefined
}

export function PersonaConfigDialog({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  existingPersona,
}: PersonaConfigDialogProps) {
  const {
    form,
    setName,
    isGenerating,
    nameError,
    generatePersona,
    loadPersona,
    resetForm,
  } = usePersona(bookId, bookTitle)

  // 编辑模式：传入 existingPersona 时预填充
  useEffect(() => {
    if (open && existingPersona) {
      loadPersona(existingPersona)
    } else if (open && !existingPersona) {
      resetForm()
    }
  }, [open, existingPersona, loadPersona, resetForm])

  const handleGenerate = async () => {
    const success = await generatePersona()
    if (success) {
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>一键生成人物</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            输入人物名后，系统会检索相关片段并自动生成对话人设。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="persona-name">人物名</Label>
            <Input
              id="persona-name"
              placeholder="如：章北海、林黛玉..."
              value={form.name}
              onChange={(e) => setName(e.target.value)}
              className={nameError ? 'ring-2 ring-red-500 ring-offset-1' : ''}
            />
            {nameError && (
              <p className="text-xs text-red-500">请输入人物名称</p>
            )}
            <p className="text-xs text-slate-500">
              将检索该人物相关的 25 条片段，并结合《{bookTitle || '当前书籍'}》自动生成系统提示词。
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={handleCancel} disabled={isGenerating}>
              取消
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  一键生成
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
