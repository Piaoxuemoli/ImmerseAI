import { useRef, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { useStore } from '@/shared/store'
import { useChat } from '../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'

export function ChatInterface() {
  const { messages, streamingContent, isGenerating, sendMessage } = useChat()

  const activePersonaId = useStore((s) => s.activePersonaId)
  const personas = useStore((s) => s.personas)
  const setPendingCitationCfi = useStore((s) => s.setPendingCitationCfi)
  const setReaderMode = useStore((s) => s.setReaderMode)
  const activePersona = activePersonaId
    ? personas.find((p) => p.id === activePersonaId)
    : undefined
  const personaName = activePersona?.name

  /**
   * 引用跳转回调：设置 pendingCitationCfi 并切换到阅读模式
   */
  const handleCitationClick = useCallback(
    (cfi: string) => {
      setPendingCitationCfi(cfi)
      setReaderMode('read')
    },
    [setPendingCitationCfi, setReaderMode],
  )

  // 底部锚点引用
  const bottomRef = useRef<HTMLDivElement>(null)
  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // 是否在底部附近
  const isNearBottomRef = useRef(true)

  /**
   * 检测用户是否在底部附近（< 100px）
   */
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const { scrollTop, scrollHeight, clientHeight } = container
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
    <div className="flex h-full flex-col">
      {/* 消息列表区域 */}
      <ScrollArea className="flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto"
        >
          {isEmpty ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400">开始与角色对话...</p>
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
    </div>
  )
}
