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
      currentCfi: null,
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
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 2048,
      },
      bookshelfRootPath: '',

      // === 书架 Actions ===
      setBooks: (books) => set({ books }),
      selectBook: (bookId) => set({ selectedBookId: bookId }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),

      // === 阅读器 Actions ===
      setCurrentCfi: (cfi) => set({ currentCfi: cfi }),
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
      setActivePersona: (personaId) => set({ activePersonaId: personaId }),
      removePersona: (personaId) =>
        set((state) => ({
          personas: state.personas.filter((p) => p.id !== personaId),
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
          const newProgress = { ...state.indexingProgress }
          delete newProgress[bookId]
          return { indexingProgress: newProgress }
        }),

      // === 设置 Actions ===
      setLlmConfig: (config) =>
        set((state) => ({
          llmConfig: { ...state.llmConfig, ...config },
        })),
      setBookshelfRootPath: (path) => set({ bookshelfRootPath: path }),
    }),
    {
      name: 'immerse-store', // localStorage key
      partialize: (state) => ({
        books: state.books,
        personas: state.personas,
        currentSession: state.currentSession,
        llmConfig: state.llmConfig,
        bookshelfRootPath: state.bookshelfRootPath,
      }),
    }
  )
)

// Re-export ImmerseStore type for convenience
export type { ImmerseStore } from '@/shared/types'
