/**
 * 新版 AIInputBar 组件 - Stitch 设计风格
 *
 * 浮动在底部居中的 AI 指令输入栏
 * - 毛玻璃效果
 * - 圆角 20px 大阴影
 * - 简洁的输入体验
 */

import { useState, useCallback } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'

interface AIInputBarProps {
  onSend: (message: string) => Promise<void>
  isLoading?: boolean
  placeholder?: string
}

export function AIInputBar({
  onSend,
  isLoading = false,
  placeholder = "询问 AI 关于你的书架...",
}: AIInputBarProps) {
  const [input, setInput] = useState('')

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return
    const message = input.trim()
    setInput('')
    await onSend(message)
  }, [input, isLoading, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="ai-input-bar">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 text-base h-auto py-0 px-0"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => void handleSend()}
        disabled={!input.trim() || isLoading}
        className="shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </Button>
    </div>
  )
}
