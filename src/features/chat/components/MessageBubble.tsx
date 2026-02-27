import { motion } from 'framer-motion'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { CitationBadge } from './CitationBadge'
import { NoteConfirmation } from './NoteConfirmation'
import type { Message } from '@/shared/types'

interface MessageBubbleProps {
  message: Message
  personaName?: string | undefined
  onCitationClick?: (paragraphIndex: number, offset?: number) => void
}

export function MessageBubble({ message, personaName, onCitationClick }: MessageBubbleProps) {
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
          <AvatarFallback className="bg-slate-800 text-xs text-white">
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
          <AvatarFallback className="bg-slate-800 text-xs text-white">
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
          <AvatarFallback className="bg-slate-800 text-xs text-white">
            {avatarText}
          </AvatarFallback>
        </Avatar>
      )}

      {/* 消息内容 */}
      <div className="flex max-w-[75%] flex-col gap-1">
        <div
          className={`rounded-lg px-3 py-2 ${
            isUser
              ? 'bg-slate-100'
              : 'border border-slate-200 bg-white'
          }`}
        >
          <p className="whitespace-pre-wrap text-sm text-slate-900">
            {message.content}
          </p>
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.citations.map((citation, index) => {
              const handleClick = onCitationClick
                ? () => onCitationClick(citation.paragraphIndex, citation.offset)
                : undefined

              return (
                <CitationBadge
                  key={index}
                  citation={citation}
                  {...(handleClick ? { onClick: handleClick } : {})}
                />
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
