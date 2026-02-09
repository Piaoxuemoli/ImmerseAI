/**
 * useBookshelf Hook
 * 
 * 管理书架的连接生命周期与书籍数据
 * - mountBookshelf: 选择目录 → 连接 MCP → 加载书籍
 * - refreshBooks: 重新扫描当前目录
 * - unmountBookshelf: 断开连接 → 清空数据
 */

import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '@/shared/store'
import type { Book, BookFile } from '@/shared/types'

/**
 * 将 BookFile 转换为 Book
 * - id: UUID v4
 * - title: 文件名去后缀
 * - author: '未知作者'
 * - path: 原路径
 * - isIndexed: false
 */
function bookFileToBook(file: BookFile): Book {
  const titleWithoutExt = file.name.replace(/\.epub$/i, '')
  return {
    id: uuidv4(),
    title: titleWithoutExt,
    author: '未知作者',
    path: file.path,
    isIndexed: false,
  }
}

export function useBookshelf() {
  // Store 状态
  const books = useStore((state) => state.books)
  const connectionStatus = useStore((state) => state.connectionStatus)
  const bookshelfRootPath = useStore((state) => state.bookshelfRootPath)
  const setBooks = useStore((state) => state.setBooks)
  const setConnectionStatus = useStore((state) => state.setConnectionStatus)
  const setBookshelfRootPath = useStore((state) => state.setBookshelfRootPath)

  // 本地状态
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 挂载书架
   * 1. 弹出目录选择对话框
   * 2. 用户取消则 return
   * 3. 否则 connecting → connect → listFiles → 过滤 .epub → 转 Book[] → setBooks + setBookshelfRootPath + connected
   * 4. 错误时 setConnectionStatus('error') 并设置 error
   */
  const mountBookshelf = useCallback(async () => {
    setError(null)

    try {
      // 1. 选择目录
      const selectedPath = await window.electronAPI.app.selectDirectory()
      if (!selectedPath) {
        // 用户取消
        return
      }

      // 2. 开始连接
      setConnectionStatus('connecting')
      setIsLoading(true)

      // 3. 连接 MCP
      await window.electronAPI.mcp.connect(selectedPath)

      // 4. 获取文件列表
      const files: BookFile[] = await window.electronAPI.mcp.listFiles(selectedPath)

      // 5. 过滤 .epub 文件并转换为 Book
      const epubFiles = files.filter((f) => f.type === 'epub')
      const newBooks = epubFiles.map(bookFileToBook)

      // 6. 更新 Store
      setBooks(newBooks)
      setBookshelfRootPath(selectedPath)
      setConnectionStatus('connected')
    } catch (err) {
      console.error('[useBookshelf] mountBookshelf error:', err)
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [setBooks, setBookshelfRootPath, setConnectionStatus])

  /**
   * 刷新书籍列表
   * 当已连接且 bookshelfRootPath 非空时，重新扫描目录
   * MCP 调用失败时设置 connectionStatus 为 'error'
   */
  const refreshBooks = useCallback(async () => {
    if (connectionStatus !== 'connected' || !bookshelfRootPath) {
      console.warn('[useBookshelf] refreshBooks: not connected or no root path')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const files: BookFile[] = await window.electronAPI.mcp.listFiles(bookshelfRootPath)
      const epubFiles = files.filter((f) => f.type === 'epub')
      const newBooks = epubFiles.map(bookFileToBook)
      setBooks(newBooks)
    } catch (err) {
      console.error('[useBookshelf] refreshBooks error:', err)
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [connectionStatus, bookshelfRootPath, setBooks, setConnectionStatus])

  /**
   * 卸载书架
   * 断开 MCP 连接并清空数据
   */
  const unmountBookshelf = useCallback(async () => {
    setError(null)

    try {
      await window.electronAPI.mcp.disconnect()
    } catch (err) {
      console.error('[useBookshelf] disconnect error:', err)
      // 忽略断开连接的错误，继续清空状态
    }

    setBooks([])
    setBookshelfRootPath('')
    setConnectionStatus('disconnected')
  }, [setBooks, setBookshelfRootPath, setConnectionStatus])

  return {
    // 状态
    books,
    connectionStatus,
    bookshelfRootPath,
    isLoading,
    error,
    // 操作
    mountBookshelf,
    unmountBookshelf,
    refreshBooks,
  }
}
