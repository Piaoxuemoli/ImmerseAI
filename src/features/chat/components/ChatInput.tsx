import { useState, useRef } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

interface ChatInputProps {
  onSend: (content: string) => void
  isGenerating: boolean
  personaName?: string | undefined
}

export function ChatInput({ onSend, isGenerating, personaName }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const placeholder = personaName
    ? `对 ${personaName} 说点什么...`
    : '输入消息...'

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isGenerating) return
    onSend(trimmed)
    setInput('')
    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // 自动调整高度
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const MAX_CHARS = 4000

  return (
    <div className="flex flex-col gap-1 border-t border-border bg-background px-4 py-3">
      {input.length > MAX_CHARS * 0.8 && (
        <span
          className={`text-xs ${
            input.length > MAX_CHARS ? 'text-red-500' : 'text-muted-foreground'
          }`}
        >
          {input.length} / {MAX_CHARS}
        </span>
      )}
      <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={handleSend}
        disabled={isGenerating || !input.trim()}
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground disabled:text-muted-foreground/30"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
    </div>
  )
}
