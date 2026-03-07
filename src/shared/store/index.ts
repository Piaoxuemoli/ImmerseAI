/**
 * ImmerseAI 全局状态管理
 * 
 * 基于 Zustand v4+ 实现，使用 persist 中间件进行选择性持久化
 * 
 * 持久化策略：
 * - 持久化到 localStorage: books, personas, currentSession (关键业务数据)
 * - 仅运行时: indexingProgress, isGenerating, connectionStatus (临时状态)
 * 
 * 用法示例：
 * ```tsx
 * // 订阅单个字段
 * const books = useStore((state) => state.books);
 * 
 * // 订阅多个字段（使用 shallow 比较）
 * import { shallow } from 'zustand/shallow';
 * const { books, selectedBookId } = useStore(
 *   (state) => ({ books: state.books, selectedBookId: state.selectedBookId }),
 *   shallow
 * );
 * 
 * // 调用 action
 * const setBooks = useStore((state) => state.setBooks);
 * setBooks(newBooks);
 * ```
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ImmerseStore } from '@/shared/types'

export const useStore = create<ImmerseStore>()(
  persist(
    (set) => ({
      // === 书架状态 ===
      books: [],
      selectedBookId: null,
      connectionStatus: 'disconnected',

      // === 阅读器状态 ===
      currentParagraphIndex: null,
      currentOffset: null,
      readerMode: 'read',

      // === 角色状态 ===
      personas: [],
      activePersonaId: null,

      // === 对话状态 ===
      currentSession: null,
      isGenerating: false,

      // === RAG 状态 ===
      indexingProgress: {},

      // === 设置状态 ===
      llmConfig: {
        baseUrl: '',
        model: '',
      },
      bookshelfRootPath: '',

      // === 笔记状态 ===
      lastNotePath: null,

      // === 引用跳转状态 ===
      pendingCitationParagraphIndex: null,
      pendingCitationOffset: null,

      // === Librarian Agent 状态 ===
      agentHistory: [],

      // === 书架 Actions ===
      setBooks: (books) => set({ books }),
      selectBook: (bookId) => set({ selectedBookId: bookId, lastNotePath: null }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),

      // === 阅读器 Actions ===
      setCurrentParagraphIndex: (index) => set({ currentParagraphIndex: index }),
      setCurrentOffset: (offset) => set({ currentOffset: offset }),
      toggleMode: () =>
        set((state) => ({
          readerMode: state.readerMode === 'read' ? 'chat' : 'read',
        })),
      setReaderMode: (mode) => set({ readerMode: mode }),

      // === 角色 Actions ===
      setPersonas: (personas) => set({ personas }),
      setPersona: (persona) =>
        set((state) => {
          const existingIndex = state.personas.findIndex((p) => p.id === persona.id)
          if (existingIndex >= 0) {
            // 更新现有角色
            const newPersonas = [...state.personas]
            newPersonas[existingIndex] = persona
            return { personas: newPersonas }
          } else {
            // 添加新角色
            return { personas: [...state.personas, persona] }
          }
        }),
      setActivePersona: (personaId) =>
        set((state) => ({
          activePersonaId: personaId,
          currentSession: state.currentSession
            ? {
                ...state.currentSession,
                personaId: personaId ?? '',
                updatedAt: Date.now(),
              }
            : null,
        })),
      removePersona: (personaId) =>
        set((state) => ({
          personas: state.personas.filter((p) => p.id !== personaId),
          activePersonaId: state.activePersonaId === personaId ? null : state.activePersonaId,
          currentSession: state.currentSession?.personaId === personaId
            ? {
                ...state.currentSession,
                personaId: '',
                updatedAt: Date.now(),
              }
            : state.currentSession,
        })),

      // === 对话 Actions ===
      setCurrentSession: (session) => set({ currentSession: session }),
      addMessage: (message) =>
        set((state) => {
          if (!state.currentSession) {
            console.warn('尝试添加消息但 currentSession 为 null')
            return state
          }
          return {
            currentSession: {
              ...state.currentSession,
              messages: [...state.currentSession.messages, message],
              updatedAt: Date.now(),
            },
          }
        }),
      setIsGenerating: (generating) => set({ isGenerating: generating }),

      // === RAG Actions ===
      setIndexingProgress: (bookId, progress) =>
        set((state) => ({
          indexingProgress: {
            ...state.indexingProgress,
            [bookId]: progress,
          },
        })),
      clearIndexingProgress: (bookId) =>
        set((state) => {
          const { [bookId]: _removed, ...remainingProgress } = state.indexingProgress
          return { indexingProgress: remainingProgress }
        }),
      markBookIndexed: (bookId, contentHash, chunkCount) =>
        set((state) => ({
          books: state.books.map((b) =>
            b.id === bookId
              ? { ...b, isIndexed: true, indexedAt: Date.now(), contentHash, chunkCount }
              : b,
          ),
        })),

      // === 设置 Actions ===
      setLlmConfig: (config) =>
        set((state) => ({
          llmConfig: { ...state.llmConfig, ...config },
        })),
      setBookshelfRootPath: (path) => set({ bookshelfRootPath: path }),

      // === 引用跳转 Actions ===
      setPendingCitationParagraphIndex: (index) => set({ pendingCitationParagraphIndex: index }),
      setPendingCitationOffset: (offset) => set({ pendingCitationOffset: offset }),

      // === 笔记 Actions ===
      setLastNotePath: (path) => set({ lastNotePath: path }),

      // === Librarian Agent Actions ===
      addAgentOperation: (operation) =>
        set((state) => {
          const appended = [...state.agentHistory, operation]
          // 保留最多 10 条记录，移除最早的（slice 不变异数组）
          const agentHistory = appended.length > 10 ? appended.slice(appended.length - 10) : appended
          return { agentHistory }
        }),
      clearAgentHistory: () => set({ agentHistory: [] }),
    }),
    {
      name: 'immerse-store', // localStorage key
      partialize: (state) => ({
        books: state.books,
        personas: state.personas,
        currentSession: state.currentSession,
        llmConfig: state.llmConfig,
        bookshelfRootPath: state.bookshelfRootPath,
        lastNotePath: state.lastNotePath,
        agentHistory: state.agentHistory,
      }),
    }
  )
)

// Re-export ImmerseStore type for convenience
export type { ImmerseStore } from '@/shared/types'
