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

  return (
    <div className="flex items-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={handleSend}
        disabled={isGenerating || !input.trim()}
        className="h-9 w-9 shrink-0 text-slate-600 hover:text-slate-900 disabled:text-slate-300"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
