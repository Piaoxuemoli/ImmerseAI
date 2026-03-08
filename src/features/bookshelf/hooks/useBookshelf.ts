/**
 * useBookshelf Hook
 *
 * 管理书架连接、目录浏览、根目录迁移与书籍扫描
 */

import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '@/shared/store'
import type { Book, BookFile } from '@/shared/types'
import { WINDOWS_ABSOLUTE_PATH_RE } from '@/shared/utils/path'

const DEFAULT_FOLDER_NAME = '无分类'

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}

function buildChildPath(parentPath: string, name: string): string {
  return normalizePath(`${parentPath}/${name}`)
}

function isRootDirectChildPath(rootPath: string, targetPath: string): boolean {
  const normalizedRoot = normalizePath(rootPath).replace(/\/+$/, '')
  const normalizedTarget = normalizePath(targetPath).replace(/\/+$/, '')
  if (!normalizedTarget.startsWith(`${normalizedRoot}/`)) return false
  const relative = normalizedTarget.slice(normalizedRoot.length + 1)
  if (!relative || relative.includes('/')) return false
  return true
}

function isTextBookFile(file: BookFile): boolean {
  return file.type === 'md' || file.type === 'txt' || file.path.endsWith('.md') || file.path.endsWith('.txt')
}

function resolveBookPath(rootPath: string, filePath: string): string {
  const isAbsolute = WINDOWS_ABSOLUTE_PATH_RE.test(filePath) || filePath.startsWith('/')
  if (isAbsolute) return normalizePath(filePath)
  const normalizedRoot = normalizePath(rootPath).replace(/[\\/]+$/, '')
  const normalizedFile = normalizePath(filePath).replace(/^[\\/]+/, '')
  return `${normalizedRoot}/${normalizedFile}`
}

function bookFileToBook(file: BookFile, rootPath: string): Book {
  const titleWithoutExt = file.name.replace(/\.(md|txt)$/i, '')
  return {
    id: uuidv4(),
    title: titleWithoutExt,
    author: '未知作者',
    path: resolveBookPath(rootPath, file.path),
    isIndexed: false,
  }
}

async function ensureDefaultFolderAndMigrateRootBooks(rootPath: string): Promise<void> {
  const rootEntries = await window.electronAPI.mcp.listFiles(rootPath)
  const defaultFolderPath = buildChildPath(rootPath, DEFAULT_FOLDER_NAME)

  const hasDefaultFolder = rootEntries.some(
    (entry) => entry.type === 'directory' && normalizePath(entry.path) === normalizePath(defaultFolderPath),
  )
  if (!hasDefaultFolder) {
    await window.electronAPI.mcp.createDirectory(defaultFolderPath)
  }

  const rootBooks = rootEntries.filter((entry) => entry.type !== 'directory' && isTextBookFile(entry))
  const booksToMove = rootBooks.filter(
    (b) => normalizePath(b.path) !== normalizePath(buildChildPath(defaultFolderPath, b.name)),
  )
  await Promise.all(
    booksToMove.map((b) =>
      window.electronAPI.mcp.moveFile(normalizePath(b.path), buildChildPath(defaultFolderPath, b.name)),
    ),
  )
}

async function scanBooksRecursively(rootPath: string): Promise<{ books: Book[]; rootEntries: BookFile[] }> {
  const queue: string[] = [rootPath]
  const allBookFiles: BookFile[] = []
  let rootEntries: BookFile[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const currentPath = queue.shift()
    if (!currentPath) continue
    const normalizedCurrent = normalizePath(currentPath)
    if (visited.has(normalizedCurrent)) continue
    visited.add(normalizedCurrent)

    const entries = await window.electronAPI.mcp.listFiles(normalizedCurrent)
    if (normalizedCurrent === normalizePath(rootPath)) {
      rootEntries = entries
    }

    for (const entry of entries) {
      if (entry.type === 'directory') {
        queue.push(normalizePath(entry.path))
        continue
      }
      if (isTextBookFile(entry)) {
        allBookFiles.push(entry)
      }
    }
  }

  return {
    books: allBookFiles.map((file) => bookFileToBook(file, rootPath)),
    rootEntries,
  }
}

export function useBookshelf() {
  const books = useStore((state) => state.books)
  const connectionStatus = useStore((state) => state.connectionStatus)
  const bookshelfRootPath = useStore((state) => state.bookshelfRootPath)
  const setBooks = useStore((state) => state.setBooks)
  const setConnectionStatus = useStore((state) => state.setConnectionStatus)
  const setBookshelfRootPath = useStore((state) => state.setBookshelfRootPath)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rootEntries, setRootEntries] = useState<BookFile[]>([])

  const loadBookshelfData = useCallback(
    async (rootPath: string) => {
      await ensureDefaultFolderAndMigrateRootBooks(rootPath)
      const { books: newBooks, rootEntries: nextRootEntries } = await scanBooksRecursively(rootPath)

      // Preserve existing book IDs and metadata across rescans so that
      // Persona.bookId, session.bookId, and RAG index keys remain stable.
      const existingBooks = useStore.getState().books
      const existingByPath = new Map(existingBooks.map((b) => [normalizePath(b.path), b]))

      const mergedBooks = newBooks.map((newBook) => {
        const existing = existingByPath.get(normalizePath(newBook.path))
        if (existing) {
          return {
            ...newBook,
            id: existing.id,
            isIndexed: existing.isIndexed,
            indexedAt: existing.indexedAt,
            contentHash: existing.contentHash,
            chunkCount: existing.chunkCount,
            lastReadAt: existing.lastReadAt,
            lastReadParagraphIndex: existing.lastReadParagraphIndex,
            lastReadOffset: existing.lastReadOffset,
          }
        }
        return newBook
      })

      setBooks(mergedBooks)
      setRootEntries(nextRootEntries)
    },
    [setBooks],
  )

  const mountBookshelf = useCallback(async () => {
    setError(null)

    try {
      const selectedPath = await window.electronAPI.app.selectDirectory()
      if (!selectedPath) return

      setConnectionStatus('connecting')
      setIsLoading(true)
      await window.electronAPI.mcp.connect(selectedPath)
      await loadBookshelfData(selectedPath)
      setBookshelfRootPath(selectedPath)
      setConnectionStatus('connected')
    } catch (err) {
      console.error('[useBookshelf] mountBookshelf error:', err)
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [loadBookshelfData, setBookshelfRootPath, setConnectionStatus])

  const autoConnect = useCallback(async () => {
    if (!bookshelfRootPath || connectionStatus !== 'disconnected') return

    setError(null)
    setConnectionStatus('connecting')
    setIsLoading(true)

    try {
      await window.electronAPI.mcp.connect(bookshelfRootPath)
      await loadBookshelfData(bookshelfRootPath)
      setConnectionStatus('connected')
    } catch (err) {
      console.error('[useBookshelf] autoConnect error:', err)
      setConnectionStatus('disconnected')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [bookshelfRootPath, connectionStatus, loadBookshelfData, setConnectionStatus])

  const refreshBooks = useCallback(async () => {
    if (connectionStatus !== 'connected' || !bookshelfRootPath) {
      console.warn('[useBookshelf] refreshBooks: not connected or no root path')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      await loadBookshelfData(bookshelfRootPath)
    } catch (err) {
      console.error('[useBookshelf] refreshBooks error:', err)
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [bookshelfRootPath, connectionStatus, loadBookshelfData, setConnectionStatus])

  const listDirectory = useCallback(async (directoryPath: string): Promise<BookFile[]> => {
    return window.electronAPI.mcp.listFiles(directoryPath)
  }, [])

  const createFolder = useCallback(
    async (folderPath: string) => {
      if (!bookshelfRootPath || !isRootDirectChildPath(bookshelfRootPath, folderPath)) {
        throw new Error('仅支持在根目录创建一级子文件夹')
      }
      await window.electronAPI.mcp.createDirectory(folderPath)
      if (bookshelfRootPath) {
        await loadBookshelfData(bookshelfRootPath)
      }
    },
    [bookshelfRootPath, loadBookshelfData],
  )

  const deleteFolder = useCallback(
    async (folderPath: string) => {
      await window.electronAPI.mcp.deleteFile(folderPath)
      if (bookshelfRootPath) {
        await loadBookshelfData(bookshelfRootPath)
      }
    },
    [bookshelfRootPath, loadBookshelfData],
  )

  const unmountBookshelf = useCallback(async () => {
    setError(null)

    try {
      await window.electronAPI.mcp.disconnect()
    } catch (err) {
      console.error('[useBookshelf] disconnect error:', err)
    }

    setBooks([])
    setRootEntries([])
    setBookshelfRootPath('')
    setConnectionStatus('disconnected')
  }, [setBooks, setBookshelfRootPath, setConnectionStatus])

  return {
    books,
    connectionStatus,
    bookshelfRootPath,
    rootEntries,
    isLoading,
    error,
    defaultFolderName: DEFAULT_FOLDER_NAME,
    mountBookshelf,
    unmountBookshelf,
    refreshBooks,
    autoConnect,
    listDirectory,
    createFolder,
    deleteFolder,
  }
}
