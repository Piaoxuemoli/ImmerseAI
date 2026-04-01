import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { RotateCcw } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { CitationBadge } from './CitationBadge'
import { NoteConfirmation } from './NoteConfirmation'
import type { Citation, Message } from '@/shared/types'

interface MessageBubbleProps {
  message: Message
  personaName?: string | undefined
  onCitationClick?: (citation: Citation) => void
  onRetry?: (message: Message) => void
}

export function MessageBubble({ message, personaName, onCitationClick, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const avatarText = personaName ? personaName.charAt(0) : 'AI'

  // 笔记确认消息 — 使用 NoteConfirmation 组件渲染
  if (message.metadata?.type === 'note-confirmation') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.08 }}
        className="flex gap-3 justify-start"
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-accent text-xs text-accent-foreground">
            {avatarText}
          </AvatarFallback>
        </Avatar>
        <div className="flex max-w-[75%] flex-col gap-1">
          <NoteConfirmation
            success={true}
            noteTitle={message.metadata.noteTitle}
            filePath={message.metadata.filePath}
          />
        </div>
      </motion.div>
    )
  }

  // 笔记错误消息 — 使用 NoteConfirmation 错误状态渲染
  if (message.metadata?.type === 'note-error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.08 }}
        className="flex gap-3 justify-start"
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-accent text-xs text-accent-foreground">
            {avatarText}
          </AvatarFallback>
        </Avatar>
        <div className="flex max-w-[75%] flex-col gap-1">
          <NoteConfirmation
            success={false}
            error={message.metadata.error}
          />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.08 }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-accent text-xs text-accent-foreground">
            {avatarText}
          </AvatarFallback>
        </Avatar>
      )}

      {/* 消息内容 */}
      <div className="flex max-w-[75%] flex-col gap-1">
        <div
          className={`rounded-lg px-3 py-2 ${
            isUser
              ? 'bg-muted'
              : 'border border-border bg-background'
          }`}
        >
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {message.content}
          </p>
        </div>

        {/* Timestamp + actions row */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(message.timestamp, { addSuffix: true, locale: zhCN })}
          </span>
          {message.metadata?.type === 'note-error' && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              重试
            </button>
          )}
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.citations.map((citation, index) => (
              <CitationBadge
                key={index}
                citation={citation}
                {...(onCitationClick ? { onClick: () => onCitationClick(citation) } : {})}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
