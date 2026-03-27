import { useRef, useEffect, useCallback, useState } from 'react'
import { UserRound, X, Trash2 } from 'lucide-react'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Button } from '@/shared/components/ui/button'
import { useStore } from '@/shared/store'
import { useChat } from '../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { CitationPopup } from './CitationPopup'
import type { Citation } from '@/shared/types'

export function ChatInterface() {
  const { messages, streamingContent, isGenerating, sendMessage } = useChat()

  const activePersonaId = useStore((s) => s.activePersonaId)
  const selectedBookId = useStore((s) => s.selectedBookId)
  const personas = useStore((s) => s.personas)
  const setActivePersona = useStore((s) => s.setActivePersona)
  const removePersona = useStore((s) => s.removePersona)
  const setPendingCitationParagraphIndex = useStore((s) => s.setPendingCitationParagraphIndex)
  const setPendingCitationOffset = useStore((s) => s.setPendingCitationOffset)
  const setReaderMode = useStore((s) => s.setReaderMode)
  const activePersona = activePersonaId
    ? personas.find((p) => p.id === activePersonaId && p.bookId === selectedBookId)
    : undefined
  const personaName = activePersona?.name

  const currentMode = useStore((s) => s.readerMode)

  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)

  const handleCitationClick = useCallback((citation: Citation) => {
    setSelectedCitation(citation)
  }, [])

  const handleCitationJump = useCallback(
    (paragraphIndex: number, offset?: number) => {
      setPendingCitationParagraphIndex(paragraphIndex)
      setPendingCitationOffset(offset ?? null)
      if (currentMode !== 'split') {
        setReaderMode('read')
      }
    },
    [currentMode, setPendingCitationParagraphIndex, setPendingCitationOffset, setReaderMode],
  )

  // 底部锚点引用
  const bottomRef = useRef<HTMLDivElement>(null)
  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // 是否在底部附近
  const isNearBottomRef = useRef(true)

  /**
   * 检测用户是否在底部附近（< 100px）
   * 使用 onScrollCapture 捕获 Radix ScrollArea viewport 的滚动事件
   */
  const handleScroll = useCallback((e: React.UIEvent) => {
    const target = e.target as HTMLElement
    if (!target) return
    const { scrollTop, scrollHeight, clientHeight } = target
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100
  }, [])

  /**
   * 自动滚动到底部（仅当用户在底部附近时）
   */
  useEffect(() => {
    if (isNearBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent])

  const isEmpty = messages.length === 0 && !streamingContent

  return (
    <div className="relative flex h-full flex-col">
      {activePersona && (
        <div className="border-b border-border bg-background px-4 py-3">
          <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{activePersona.name}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {activePersona.description || '已为当前书籍启用该人物设定。'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => setActivePersona(null)}
              >
                <X className="mr-1 h-4 w-4" />
                停用
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={() => removePersona(activePersona.id)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 消息列表区域 */}
      <ScrollArea className="flex-1" onScrollCapture={handleScroll}>
        <div ref={scrollContainerRef}>
          {isEmpty ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">开始与角色对话...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4">
              {/* 已保存的消息 */}
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  personaName={personaName}
                  onCitationClick={handleCitationClick}
                />
              ))}

              {/* 流式生成中的 AI 消息 */}
              {isGenerating && streamingContent && (
                <MessageBubble
                  message={{
                    id: '__streaming__',
                    role: 'assistant',
                    content: streamingContent,
                    timestamp: Date.now(),
                  }}
                  personaName={personaName}
                />
              )}

              {/* 底部锚点 */}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 底部输入区 */}
      <ChatInput
        onSend={sendMessage}
        isGenerating={isGenerating}
        personaName={personaName}
      />

      {/* Citation frosted glass popup */}
      {selectedCitation && (
        <CitationPopup
          citation={selectedCitation}
          onClose={() => setSelectedCitation(null)}
          onJump={handleCitationJump}
        />
      )}
    </div>
  )
}
