/**
 * BookshelfPage - Stitch Design
 *
 * 新版书架页面：
 * - 左侧文件夹导航 (240px)
 * - 主内容区：标题 + 操作栏 + 书籍网格
 * - 底部浮动 AI 输入栏
 */

import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, LayoutGrid, List, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useStore } from '@/shared/store'
import type { Book, BookFile } from '@/shared/types'
import { SidebarNew } from './components/SidebarNew'
import { BookGridNew } from './components/BookGridNew'
import { BookList } from './components/BookList'
import { LibrarianBar } from './components/LibrarianBar'
import { ParticleExplosion } from './components/ParticleExplosion'
import { useBookshelf } from './hooks/useBookshelf'

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}

function parentPath(path: string): string {
  const normalized = normalizePath(path).replace(/\/$/, '')
  const lastSlashIndex = normalized.lastIndexOf('/')
  if (lastSlashIndex <= 0) return normalized
  return normalized.slice(0, lastSlashIndex)
}

function baseName(path: string): string {
  const normalized = normalizePath(path).replace(/\/$/, '')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || normalized
}

export function BookshelfPage() {
  const navigate = useNavigate()
  const selectBook = useStore((state) => state.selectBook)

  const {
    books,
    connectionStatus,
    bookshelfRootPath,
    rootEntries,
    defaultFolderName,
    isLoading,
    error,
    mountBookshelf,
    autoConnect,
    refreshBooks,
    listDirectory,
    createFolder,
    deleteFolder,
  } = useBookshelf()

  const [activeFolderPath, setActiveFolderPath] = useState('')
  const [activeFolderEntries, setActiveFolderEntries] = useState<BookFile[]>([])
  const [isFolderLoading, setIsFolderLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // 删除动画状态
  const [deletingBook, setDeletingBook] = useState<{ book: Book; x: number; y: number } | null>(null)

  // 自动连接
  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    if (connectionStatus === 'connected') {
      void refreshBooks()
    } else {
      void autoConnect()
    }
  }, [connectionStatus, refreshBooks, autoConnect])

  // 错误状态
  const prevStatusRef = useRef(connectionStatus)
  useEffect(() => {
    if (connectionStatus === 'error' && prevStatusRef.current !== 'error') {
      toast.error('书架连接已断开，请重新选择目录')
    }
    prevStatusRef.current = connectionStatus
  }, [connectionStatus])

  const defaultFolderPath = useMemo(() => {
    if (!bookshelfRootPath) return ''
    return normalizePath(`${bookshelfRootPath}/${defaultFolderName}`)
  }, [bookshelfRootPath, defaultFolderName])

  useEffect(() => {
    if (connectionStatus !== 'connected' || !defaultFolderPath) return
    if (!activeFolderPath) {
      setActiveFolderPath(defaultFolderPath)
    }
  }, [activeFolderPath, connectionStatus, defaultFolderPath])

  const loadActiveFolderEntries = useCallback(
    async (targetPath: string) => {
      if (!targetPath || connectionStatus !== 'connected') return
      setIsFolderLoading(true)
      try {
        const entries = await listDirectory(targetPath)
        setActiveFolderEntries(entries)
      } catch (err) {
        setActiveFolderEntries([])
        const errorMessage = err instanceof Error ? err.message : String(err)
        toast.error(`目录读取失败：${errorMessage}`)
      } finally {
        setIsFolderLoading(false)
      }
    },
    [connectionStatus, listDirectory],
  )

  useEffect(() => {
    if (!activeFolderPath || connectionStatus !== 'connected') return
    void loadActiveFolderEntries(activeFolderPath)
  }, [activeFolderPath, connectionStatus, loadActiveFolderEntries])

  const rootFolders = useMemo(
    () => rootEntries.filter((entry) => entry.type === 'directory'),
    [rootEntries],
  )

  const activeBooks = useMemo(() => {
    if (!activeFolderPath) return []
    const normalizedFolderPath = normalizePath(activeFolderPath)
    return books.filter(
      (book) => normalizePath(parentPath(book.path)) === normalizedFolderPath,
    )
  }, [activeFolderPath, books])

  const handleBookClick = useCallback(
    (bookId: string) => {
      selectBook(bookId)
      navigate(`/reader/${bookId}`)
    },
    [selectBook, navigate],
  )

  const handleLibrarianSuccess = useCallback(async () => {
    const nextPath = activeFolderPath || defaultFolderPath
    await Promise.all([
      refreshBooks(),
      nextPath ? loadActiveFolderEntries(nextPath) : Promise.resolve(),
    ])
  }, [activeFolderPath, defaultFolderPath, loadActiveFolderEntries, refreshBooks])

  // 处理书籍删除（带粒子动画）
  const handleBookDelete = useCallback(
    (book: Book, rect: DOMRect) => {
      if (!window.confirm(`确定要删除《${book.title}》吗？`)) return
      // 触发粒子动画，动画结束后删除
      setDeletingBook({
        book,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    },
    []
  )

  // 粒子动画完成后的处理
  const handleParticleComplete = useCallback(async () => {
    if (!deletingBook) return
    try {
      // 调用 MCP 删除文件
      await window.electronAPI.mcp.deleteFile(deletingBook.book.path)
      toast.success(`已删除：${deletingBook.book.title}`)
      // 刷新列表
      await handleLibrarianSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingBook(null)
    }
  }, [deletingBook, handleLibrarianSuccess])

  const handleRefreshClick = useCallback(async () => {
    if (isRefreshing || connectionStatus !== 'connected') return
    setIsRefreshing(true)
    try {
      const nextPath = activeFolderPath || defaultFolderPath
      await Promise.all([
        refreshBooks(),
        nextPath ? loadActiveFolderEntries(nextPath) : Promise.resolve(),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }, [
    isRefreshing,
    connectionStatus,
    refreshBooks,
    activeFolderPath,
    defaultFolderPath,
    loadActiveFolderEntries,
  ])

  const handleCreateFolder = useCallback(async () => {
    if (!bookshelfRootPath) return
    const newFolderName = window.prompt('请输入新文件夹名称')
    if (!newFolderName || !newFolderName.trim()) return
    const sanitizedName = newFolderName.trim().replace(/[\\/]/g, '')
    if (!sanitizedName) {
      toast.error('文件夹名称不合法')
      return
    }
    const basePath = normalizePath(bookshelfRootPath)
    const newFolderPath = normalizePath(`${basePath}/${sanitizedName}`)
    try {
      await createFolder(newFolderPath)
      await Promise.all([
        refreshBooks(),
        loadActiveFolderEntries(activeFolderPath || defaultFolderPath || basePath),
      ])
      toast.success(`已创建文件夹：${sanitizedName}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建文件夹失败')
    }
  }, [
    bookshelfRootPath,
    createFolder,
    refreshBooks,
    activeFolderPath,
    defaultFolderPath,
    loadActiveFolderEntries,
  ])

  // 未连接状态
  if (connectionStatus === 'disconnected' || connectionStatus === 'connecting' || connectionStatus === 'error') {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">欢迎使用 ImmerseAI</h1>
          <p className="text-muted-foreground mb-6">
            选择一个文件夹作为你的书架，开始 AI 阅读之旅
          </p>
          {error && <p className="text-destructive text-sm mb-4">{error}</p>}
          <Button onClick={() => void autoConnect()} className="gap-2">
            <BookOpen className="w-4 h-4" />
            选择书架目录
          </Button>
        </div>
      </div>
    )
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">
      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden pb-[88px]">
        {/* 左侧边栏 */}
        <SidebarNew
          folders={rootFolders}
          activeFolderPath={activeFolderPath}
          onFolderClick={setActiveFolderPath}
          onCreateFolder={handleCreateFolder}
        />

        {/* 主内容 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* 顶部栏 */}
          <header className="shrink-0 px-6 py-4 border-b border-border bg-background">
            <div className="flex items-center justify-between">
              {/* 标题 */}
              <div>
                <h1 className="text-xl font-semibold text-foreground">{activeFolderPath ? baseName(activeFolderPath) : '我的书架'}</h1>
                <p className="text-sm text-muted-foreground">
                  {activeBooks.length} 本书籍 · {rootFolders.length} 个文件夹
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2">
                {/* 刷新 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleRefreshClick()}
                  disabled={isRefreshing}
                  title="刷新"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>

                {/* 视图切换 */}
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                    title="网格视图"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                    title="列表视图"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* 书籍网格 */}
          <div className="flex-1 overflow-y-auto">
            {activeBooks.length > 0 ? (
              viewMode === 'grid' ? (
                <BookGridNew books={activeBooks} onBookClick={handleBookClick} onBookDelete={handleBookDelete} />
              ) : (
                <BookList books={activeBooks} onBookClick={handleBookClick} />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-medium text-foreground mb-2">书架为空</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  当前文件夹还没有书籍。你可以导入文档或让 AI 帮你整理书架。
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* LibrarianBar (用于历史记录等) */}
      <LibrarianBar
        files={activeFolderEntries}
        rootFolders={rootFolders}
        onCommandSuccess={handleLibrarianSuccess}
      />

      {/* 删除粒子动画 */}
      {deletingBook && (
        <ParticleExplosion
          x={deletingBook.x}
          y={deletingBook.y}
          onComplete={handleParticleComplete}
        />
      )}
    </div>
  )
}
