import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useStore } from '@/shared/store'
import type { Message, ChatSession, RagSearchResult } from '@/shared/types'
import { detectNoteIntent } from '../utils/note-intent'
import { generateNoteContent } from '../services/note-generator'
import { writeNote } from '../services/note-writer'
import { createLlmStream } from '@/shared/utils/llm-stream'
import {
  buildCitations,
  buildRagContext,
  injectRagContext,
  searchBookContext,
} from '../services/persona-generator'

function generateId(): string {
  return crypto.randomUUID()
}

interface UseChatReturn {
  messages: Message[]
  streamingContent: string
  isGenerating: boolean
  sendMessage: (content: string) => Promise<void>
  stopGenerating: () => void
  lastNotePath: string | null
}

export function useChat(): UseChatReturn {
  const [streamingContent, setStreamingContent] = useState('')

  // Store 状态读取
  const currentSession = useStore((s) => s.currentSession)
  const isGenerating = useStore((s) => s.isGenerating)
  const activePersonaId = useStore((s) => s.activePersonaId)
  const selectedBookId = useStore((s) => s.selectedBookId)
  const personas = useStore((s) => s.personas)
  const lastNotePath = useStore((s) => s.lastNotePath)
  const llmConfig = useStore((s) => s.llmConfig)

  // Store actions
  const setCurrentSession = useStore((s) => s.setCurrentSession)
  const addMessage = useStore((s) => s.addMessage)
  const setIsGenerating = useStore((s) => s.setIsGenerating)
  const setLastNotePath = useStore((s) => s.setLastNotePath)

  // 活跃 reader 引用（用于 cancel）
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null)
  // ref 追踪 streamingContent 用于 cleanup/stop 时获取最新值
  const streamingContentRef = useRef('')

  // 同步 streamingContent 到 ref（直接赋值，无需 useEffect）
  streamingContentRef.current = streamingContent

  const messages = currentSession?.messages ?? []

  // 获取活跃 Persona
  const activePersona = activePersonaId
    ? personas.find((p) => p.id === activePersonaId && p.bookId === selectedBookId)
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
   * 处理笔记生成与写入流程
   */
  const handleNoteFlow = useCallback(async (isAppend: boolean, topic?: string) => {
    setIsGenerating(true)

    // 检查 MCP 连接状态
    const currentConnectionStatus = useStore.getState().connectionStatus
    if (currentConnectionStatus !== 'connected') {
      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: '请先在设置中配置书架路径并连接 MCP',
        timestamp: Date.now(),
        metadata: { type: 'note-error', error: '请先在设置中配置书架路径并连接 MCP' },
      }
      addMessage(errorMsg)
      setIsGenerating(false)
      return
    }

    // 获取当前书籍信息
    const state = useStore.getState()
    const currentBook = state.books.find((b) => b.id === state.selectedBookId)
    const bookTitle = currentBook?.title ?? '未知书籍'
    const currentMessages = state.currentSession?.messages ?? []
    const currentBookshelfPath = state.bookshelfRootPath
    const currentLastNotePath = state.lastNotePath

    // 插入 "正在生成笔记..." 临时消息
    const loadingMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: '正在生成笔记...',
      timestamp: Date.now(),
    }
    addMessage(loadingMsg)

    try {
      // 1. 生成笔记内容
      const noteContent = await generateNoteContent(currentMessages, bookTitle, llmConfig, topic)

      // 从笔记内容中提取标题（第一个 # 标题行）
      const titleMatch = noteContent.match(/^#\s+(.+)$/m)
      const noteTitle = titleMatch?.[1] ?? topic ?? '阅读笔记'

      // 2. 写入文件
      const isAppendMode = isAppend && !!currentLastNotePath
      const result = await writeNote(
        currentBookshelfPath,
        bookTitle,
        noteTitle,
        noteContent,
        isAppendMode,
        isAppendMode ? currentLastNotePath ?? undefined : undefined,
      )

      // 3. 移除临时 loading 消息并插入确认消息
      // 通过直接操作 Store 替换最后一条消息
      const latestSession = useStore.getState().currentSession
      if (latestSession) {
        const updatedMessages = latestSession.messages.filter((m) => m.id !== loadingMsg.id)
        useStore.getState().setCurrentSession({
          ...latestSession,
          messages: updatedMessages,
          updatedAt: Date.now(),
        })
      }

      if (result.success) {
        const confirmMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: noteContent,
          timestamp: Date.now(),
          metadata: {
            type: 'note-confirmation',
            filePath: result.filePath,
            noteTitle,
          },
        }
        addMessage(confirmMsg)
        setLastNotePath(result.filePath)
      } else {
        const errorMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: `[笔记错误] ${result.error}`,
          timestamp: Date.now(),
          metadata: {
            type: 'note-error',
            error: result.error,
          },
        }
        addMessage(errorMsg)
      }
    } catch (error) {
      // 移除临时 loading 消息
      const latestSession = useStore.getState().currentSession
      if (latestSession) {
        const updatedMessages = latestSession.messages.filter((m) => m.id !== loadingMsg.id)
        useStore.getState().setCurrentSession({
          ...latestSession,
          messages: updatedMessages,
          updatedAt: Date.now(),
        })
      }

      const errorMessage = error instanceof Error ? error.message : '未知错误'
      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `[笔记错误] ${errorMessage}`,
        timestamp: Date.now(),
        metadata: {
          type: 'note-error',
          error: errorMessage,
        },
      }
      addMessage(errorMsg)
    } finally {
      setIsGenerating(false)
    }
  }, [addMessage, llmConfig, setIsGenerating, setLastNotePath])

  /**
   * 发送消息并触发 LLM 流式调用
   */
  const sendMessage = useCallback(async (content: string) => {
    if (isGenerating) return

    // 1. 自动创建 ChatSession（如果不存在）
    let session = useStore.getState().currentSession
    if (!session || (selectedBookId && session.bookId !== selectedBookId)) {
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

    // 3. 笔记意图检测
    const noteIntent = detectNoteIntent(content)

    if (noteIntent.isNote) {
      // ── 笔记流程 ──
      await handleNoteFlow(noteIntent.isAppend, noteIntent.topic)
      return
    }

    // ── 常规对话流程 ──
    // 4. 构建 LLM messages 数组
    const updatedSession = useStore.getState().currentSession
    if (!updatedSession) {
      setIsGenerating(false)
      return
    }
    const llmMessages: Message[] = []
    const effectiveBookId = selectedBookId || updatedSession.bookId
    let ragResults: RagSearchResult[] = []

    if (effectiveBookId) {
      try {
        const ragQuery = activePersona?.name
          ? `${activePersona.name} ${content}`
          : content
        ragResults = await searchBookContext(effectiveBookId, ragQuery, 5)
      } catch {
        ragResults = []
      }
    }

    // 如果有活跃 Persona，插入 system prompt
    if (activePersona?.systemPrompt) {
      llmMessages.push({
        id: generateId(),
        role: 'system',
        content: injectRagContext(activePersona.systemPrompt, ragResults),
        timestamp: 0,
      })
    } else if (ragResults.length > 0) {
      llmMessages.push({
        id: generateId(),
        role: 'system',
        content: `你正在和用户讨论当前书籍，请优先依据以下原文片段回答；若信息不足，请明确说明这是基于角色或上下文的合理推测。\n\n${buildRagContext(ragResults)}`,
        timestamp: 0,
      })
    }

    // 加入完整消息历史
    llmMessages.push(...updatedSession.messages)

    // 5. 调用 LLM API
    setIsGenerating(true)
    setStreamingContent('')
    streamingContentRef.current = ''

    try {
      // 6. 在渲染侧构建 ReadableStream，逐 chunk 读取
      const stream = createLlmStream(llmMessages, { ...llmConfig, stream: true })
      const reader = stream.getReader()
      readerRef.current = reader

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

        // 7. 流式完成 → 保存完整 assistant 消息
        const assistantMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
          ...(activePersonaId ? { personaId: activePersonaId } : {}),
          ...(ragResults.length > 0 ? { citations: buildCitations(ragResults) } : {}),
        }
        addMessage(assistantMsg)
      } catch (readError) {
        // 流式读取中断（LLM 错误或用户取消）
        try { reader.cancel() } catch { /* ignore */ }
        if (readError instanceof Error && readError.message) {
          toast.error(readError.message)
        }
        savePartialMessage(streamingContentRef.current)
      }
    } catch (apiError) {
      // LLM API 调用失败 - 展示 Toast 通知
      const errorMessage = apiError instanceof Error ? apiError.message : '未知错误'
      toast.error(errorMessage)

      // 同时在对话中插入错误消息（供用户回顾）
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
    handleNoteFlow,
    llmConfig,
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
      }
      setIsGenerating(false)
    }
  }, [setIsGenerating])

  return {
    messages,
    streamingContent,
    isGenerating,
    sendMessage,
    stopGenerating,
    lastNotePath,
  }
}
