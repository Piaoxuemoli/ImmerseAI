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
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { usePersona } from '@/features/persona/hooks/usePersona'
import type { Persona } from '@/shared/types'

interface PersonaConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookId: string
  existingPersona?: Persona | undefined
}

export function PersonaConfigDialog({
  open,
  onOpenChange,
  bookId,
  existingPersona,
}: PersonaConfigDialogProps) {
  const {
    form,
    setField,
    isGenerating,
    nameError,
    generatePersona,
    savePersona,
    loadPersona,
    resetForm,
  } = usePersona(bookId)

  // 编辑模式：传入 existingPersona 时预填充
  useEffect(() => {
    if (open && existingPersona) {
      loadPersona(existingPersona)
    } else if (open && !existingPersona) {
      resetForm()
    }
  }, [open, existingPersona, loadPersona, resetForm])

  const handleSave = () => {
    const success = savePersona()
    if (success) {
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>🎭 角色配置</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            为书中角色创建人设，开启沉浸式对话
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-140px)] px-6">
          <div className="space-y-4 pb-4">
            {/* 角色名称（必填） */}
            <div className="space-y-2">
              <Label htmlFor="persona-name">角色名称</Label>
              <Input
                id="persona-name"
                placeholder="如：章北海、林黛玉..."
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className={nameError ? 'ring-2 ring-red-500 ring-offset-1' : ''}
              />
              {nameError && (
                <p className="text-xs text-red-500">请输入角色名称</p>
              )}
            </div>

            {/* 角色描述（可选） */}
            <div className="space-y-2">
              <Label htmlFor="persona-description">角色描述</Label>
              <Textarea
                id="persona-description"
                placeholder="简要描述角色特征（可选）"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            </div>

            {/* 一键生成按钮 */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={generatePersona}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  ✨ 一键生成人设
                </>
              )}
            </Button>

            {/* 分隔线 */}
            <div className="border-t border-slate-200" />

            {/* 生成结果展示与编辑 */}
            <div className="space-y-2">
              <Label htmlFor="persona-personality">性格特征</Label>
              <Textarea
                id="persona-personality"
                placeholder="如：沉稳、果断、有远见..."
                value={form.personality}
                onChange={(e) => setField('personality', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona-speechStyle">说话风格</Label>
              <Textarea
                id="persona-speechStyle"
                placeholder="如：简洁有力，军人气质..."
                value={form.speechStyle}
                onChange={(e) => setField('speechStyle', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona-background">背景故事</Label>
              <Textarea
                id="persona-background"
                placeholder="角色的成长经历和背景..."
                value={form.background}
                onChange={(e) => setField('background', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona-keyQuotes">代表性台词</Label>
              <Textarea
                id="persona-keyQuotes"
                placeholder={"每行一句台词\n\"不要让人类的感情左右...\"\n\"这是我的推测。\""}
                value={form.keyQuotesText}
                onChange={(e) => setField('keyQuotesText', e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <p className="text-xs text-slate-400">每行一句台词</p>
            </div>
          </div>
        </ScrollArea>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <Button variant="ghost" onClick={handleCancel}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存角色
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
