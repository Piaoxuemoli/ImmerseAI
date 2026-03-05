import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { BookFile } from '@/shared/types'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Button } from '@/shared/components/ui/button'
import { useStore } from '@/shared/store'
import { FolderOpen, BookOpen, Plus, Loader2, Trash2, ArrowLeft } from 'lucide-react'
import { TopBar } from './components/TopBar'
import { BookGrid } from './components/BookGrid'
import { LibrarianBar } from './components/LibrarianBar'
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

  // 应用启动时若有已保存路径则自动重连
  useEffect(() => {
    autoConnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 用于跟踪上一次的 connectionStatus，避免初始 render 时误弹 Toast
  const prevStatusRef = useRef(connectionStatus)

  // 当 connectionStatus 变为 'error' 时显示 Toast（带节流）
  useEffect(() => {
    // 只在状态从非 error 变为 error 时触发
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

  // 将 books 转换为 BookFile 格式供 LibrarianBar 使用
  const bookFiles: BookFile[] = useMemo(() => {
    return books.map((book) => ({
      name: book.path.split('/').pop() || book.title,
      path: book.path,
      size: 0,
      type: book.path.endsWith('.md') ? 'md' as const : book.path.endsWith('.txt') ? 'txt' as const : 'unknown' as const,
      lastModified: Date.now(),
    }))
  }, [books])

  const rootFolders = useMemo(() => {
    return rootEntries.filter((entry) => entry.type === 'directory')
  }, [rootEntries])

  const activeBooks = useMemo(() => {
    if (!activeFolderPath) return []
    const normalizedFolderPath = normalizePath(activeFolderPath)
    return books.filter((book) => normalizePath(parentPath(book.path)) === normalizedFolderPath)
  }, [activeFolderPath, books])

  const childFolders = useMemo(() => {
    return activeFolderEntries.filter((entry) => entry.type === 'directory')
  }, [activeFolderEntries])

  // 点击书籍卡片
  const handleBookClick = useCallback((bookId: string) => {
    selectBook(bookId)
    navigate(`/reader/${bookId}`)
  }, [selectBook, navigate])

  // 导航到设置页
  const handleSettingsClick = useCallback(() => {
    navigate('/settings')
  }, [navigate])

  const handleOpenFolder = useCallback((folderPath: string) => {
    setActiveFolderPath(normalizePath(folderPath))
  }, [])

  const handleBackToParent = useCallback(() => {
    if (!activeFolderPath || !bookshelfRootPath) return
    const parent = parentPath(activeFolderPath)
    const normalizedRoot = normalizePath(bookshelfRootPath)
    if (parent.startsWith(normalizedRoot) && parent !== activeFolderPath) {
      setActiveFolderPath(parent)
    }
  }, [activeFolderPath, bookshelfRootPath])

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
      await refreshBooks()
      await loadActiveFolderEntries(activeFolderPath || defaultFolderPath || basePath)
      toast.success(`已创建文件夹：${sanitizedName}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建文件夹失败')
    }
  }, [activeFolderPath, bookshelfRootPath, createFolder, defaultFolderPath, loadActiveFolderEntries, refreshBooks])

  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
      const folderName = baseName(folderPath)
      if (!window.confirm(`确认删除文件夹 "${folderName}" 吗？此操作不可撤销。`)) return
      try {
        await deleteFolder(folderPath)
        await refreshBooks()
        const fallbackPath = activeFolderPath === normalizePath(folderPath) ? defaultFolderPath : activeFolderPath
        if (fallbackPath) {
          setActiveFolderPath(fallbackPath)
          await loadActiveFolderEntries(fallbackPath)
        }
        toast.success(`已删除文件夹：${folderName}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除文件夹失败')
      }
    },
    [activeFolderPath, defaultFolderPath, deleteFolder, loadActiveFolderEntries, refreshBooks],
  )

  const handleLibrarianSuccess = useCallback(async () => {
    await refreshBooks()
    const nextPath = activeFolderPath || defaultFolderPath
    if (nextPath) {
      await loadActiveFolderEntries(nextPath)
    }
  }, [activeFolderPath, defaultFolderPath, loadActiveFolderEntries, refreshBooks])

  // 未连接状态 UI
  const renderDisconnectedState = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6">
        <FolderOpen className="w-10 h-10 text-zinc-400" />
      </div>
      <h2 className="text-xl font-semibold text-zinc-800 mb-2">选择书架目录</h2>
      <p className="text-zinc-500 mb-6 max-w-md">
        选择一个包含 .md / .txt 文件的文件夹，ImmerseAI 将扫描并加载其中的文档
      </p>
      <Button onClick={mountBookshelf} className="gap-2">
        <FolderOpen className="w-4 h-4" />
        选择目录
      </Button>
      {error && (
        <p className="text-red-500 text-sm mt-4">{error}</p>
      )}
    </div>
  )

  // 加载中状态 UI
  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center h-[60vh]">
      <Loader2 className="w-10 h-10 text-zinc-400 animate-spin mb-4" />
      <p className="text-zinc-500">正在加载书籍...</p>
    </div>
  )

  // 空书架状态 UI
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6">
        <BookOpen className="w-10 h-10 text-zinc-400" />
      </div>
      <h2 className="text-xl font-semibold text-zinc-800 mb-2">书架是空的</h2>
      <p className="text-zinc-500 mb-6 max-w-md">
        当前目录中没有找到 .md / .txt 文件。请添加一些文档，或选择其他目录。
      </p>
      <Button variant="outline" onClick={mountBookshelf} className="gap-2">
        <Plus className="w-4 h-4" />
        更换目录
      </Button>
    </div>
  )

  const renderFolderCard = (folder: BookFile) => (
    <div
      key={folder.path}
      className="rounded-md border border-slate-200 bg-white p-3 hover:bg-slate-50"
    >
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => handleOpenFolder(folder.path)}
      >
        <FolderOpen className="h-4 w-4 text-slate-500" />
        <span className="truncate text-sm text-slate-700">{folder.name}</span>
      </button>
    </div>
  )

  // 根据状态渲染内容
  const renderContent = () => {
    // 加载中
    if (isLoading) {
      return renderLoadingState()
    }

    // 未连接或连接中
    if (connectionStatus === 'disconnected' || connectionStatus === 'connecting') {
      return renderDisconnectedState()
    }

    // 错误状态
    if (connectionStatus === 'error') {
      return renderDisconnectedState()
    }

    // 已连接但目录尚未加载
    if (connectionStatus === 'connected' && rootEntries.length === 0) {
      return renderEmptyState()
    }

    // 已连接且有内容（目录化视图）
    return (
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6 pb-20">
        <div className="w-64 shrink-0 rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">文件夹</h3>
            <Button variant="ghost" size="icon" onClick={handleCreateFolder} title="新增文件夹">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {rootFolders.map((folder) => {
              const isActive = normalizePath(folder.path) === normalizePath(activeFolderPath)
              return (
                <button
                  key={folder.path}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => handleOpenFolder(folder.path)}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="truncate">{folder.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">当前目录</div>
              <div className="truncate font-medium text-slate-800">
                {activeFolderPath || defaultFolderPath || bookshelfRootPath}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToParent}
                disabled={!activeFolderPath || normalizePath(activeFolderPath) === normalizePath(bookshelfRootPath)}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回上级
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => activeFolderPath && void handleDeleteFolder(activeFolderPath)}
                disabled={!activeFolderPath || normalizePath(activeFolderPath) === normalizePath(defaultFolderPath)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                删除文件夹
              </Button>
            </div>
          </div>

          {isFolderLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : (
            <>
              {childFolders.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 text-sm font-medium text-slate-600">子文件夹</div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                    {childFolders.map((folder) => renderFolderCard(folder))}
                  </div>
                </div>
              )}

              {activeBooks.length > 0 ? (
                <BookGrid books={activeBooks} onBookClick={handleBookClick} />
              ) : childFolders.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  当前文件夹为空，可新增子文件夹后导入书籍，或通过 LLM 指令移动书籍到此目录。
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <TopBar
        onSettingsClick={handleSettingsClick}
        onImportClick={mountBookshelf}
      />
      <ScrollArea className="h-[calc(100vh-52px)]">
        {renderContent()}
      </ScrollArea>
      {connectionStatus === 'connected' && (
        <LibrarianBar files={bookFiles} onCommandSuccess={handleLibrarianSuccess} />
      )}
    </div>
  )
}
