import { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '@/shared/store'
import type { Message, ChatSession } from '@/shared/types'

function generateId(): string {
  return crypto.randomUUID()
}

interface UseChatReturn {
  messages: Message[]
  streamingContent: string
  isGenerating: boolean
  sendMessage: (content: string) => Promise<void>
  stopGenerating: () => void
}

export function useChat(): UseChatReturn {
  const [streamingContent, setStreamingContent] = useState('')

  // Store 状态读取
  const currentSession = useStore((s) => s.currentSession)
  const isGenerating = useStore((s) => s.isGenerating)
  const activePersonaId = useStore((s) => s.activePersonaId)
  const selectedBookId = useStore((s) => s.selectedBookId)
  const personas = useStore((s) => s.personas)

  // Store actions
  const setCurrentSession = useStore((s) => s.setCurrentSession)
  const addMessage = useStore((s) => s.addMessage)
  const setIsGenerating = useStore((s) => s.setIsGenerating)

  // 活跃 reader 引用（用于 cancel）
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null)
  // ref 追踪 streamingContent 用于 cleanup/stop 时获取最新值
  const streamingContentRef = useRef('')

  // 同步 streamingContent 到 ref
  useEffect(() => {
    streamingContentRef.current = streamingContent
  }, [streamingContent])

  const messages = currentSession?.messages ?? []

  // 获取活跃 Persona
  const activePersona = activePersonaId
    ? personas.find((p) => p.id === activePersonaId)
    : undefined

  /**
   * 保存已有 streamingContent 为 assistant 消息
   */
  const savePartialMessage = useCallback((content: string) => {
    if (content.length > 0) {
      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        ...(activePersonaId ? { personaId: activePersonaId } : {}),
      }
      addMessage(assistantMsg)
    }
  }, [addMessage, activePersonaId])

  /**
   * 发送消息并触发 LLM 流式调用
   */
  const sendMessage = useCallback(async (content: string) => {
    if (isGenerating) return

    // 1. 自动创建 ChatSession（如果不存在）
    let session = useStore.getState().currentSession
    if (!session) {
      const newSession: ChatSession = {
        id: generateId(),
        bookId: selectedBookId ?? '',
        personaId: activePersonaId ?? '',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setCurrentSession(newSession)
      session = newSession
    }

    // 2. 追加用户消息
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    addMessage(userMessage)

    // 3. 构建 LLM messages 数组
    const updatedSession = useStore.getState().currentSession!
    const llmMessages: Message[] = []

    // 如果有活跃 Persona，插入 system prompt
    if (activePersona?.systemPrompt) {
      llmMessages.push({
        id: generateId(),
        role: 'system',
        content: activePersona.systemPrompt,
        timestamp: 0,
      })
    }

    // 加入完整消息历史
    llmMessages.push(...updatedSession.messages)

    // 4. 调用 LLM API
    setIsGenerating(true)
    setStreamingContent('')
    streamingContentRef.current = ''

    try {
      const stream = await window.electronAPI.llm.chat(llmMessages, {
        stream: true,
      })
      const reader = stream.getReader()
      readerRef.current = reader

      // 5. 逐 chunk 读取
      let fullContent = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            fullContent += value
            setStreamingContent(fullContent)
            streamingContentRef.current = fullContent
          }
        }

        // 6. 流式完成 → 保存完整 assistant 消息
        const assistantMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
          ...(activePersonaId ? { personaId: activePersonaId } : {}),
        }
        addMessage(assistantMsg)
      } catch (readError) {
        // 流式读取中断
        try { reader.cancel() } catch { /* ignore */ }
        savePartialMessage(streamingContentRef.current)
      }
    } catch (apiError) {
      // LLM API 调用失败
      const errorMessage = apiError instanceof Error ? apiError.message : '未知错误'
      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `[错误] ${errorMessage}`,
        timestamp: Date.now(),
        ...(activePersonaId ? { personaId: activePersonaId } : {}),
      }
      addMessage(errorMsg)
    } finally {
      readerRef.current = null
      setStreamingContent('')
      streamingContentRef.current = ''
      setIsGenerating(false)
    }
  }, [
    isGenerating,
    selectedBookId,
    activePersonaId,
    activePersona,
    setCurrentSession,
    addMessage,
    setIsGenerating,
    savePartialMessage,
  ])

  /**
   * 中止当前流式生成
   */
  const stopGenerating = useCallback(() => {
    if (readerRef.current) {
      try { readerRef.current.cancel() } catch { /* ignore */ }
      readerRef.current = null
    }
    savePartialMessage(streamingContentRef.current)
    setStreamingContent('')
    streamingContentRef.current = ''
    setIsGenerating(false)
  }, [savePartialMessage, setIsGenerating])

  /**
   * 组件卸载清理
   */
  useEffect(() => {
    return () => {
      if (readerRef.current) {
        try { readerRef.current.cancel() } catch { /* ignore */ }
        readerRef.current = null
        setIsGenerating(false)
      }
    }
  }, [setIsGenerating])

  return {
    messages,
    streamingContent,
    isGenerating,
    sendMessage,
    stopGenerating,
  }
}
