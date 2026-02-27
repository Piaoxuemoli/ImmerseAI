import { useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { BookFile } from '@/shared/types'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Button } from '@/shared/components/ui/button'
import { useStore } from '@/shared/store'
import { FolderOpen, BookOpen, Plus, Loader2 } from 'lucide-react'
import { TopBar } from './components/TopBar'
import { BookGrid } from './components/BookGrid'
import { LibrarianBar } from './components/LibrarianBar'
import { useBookshelf } from './hooks/useBookshelf'

export function BookshelfPage() {
  const navigate = useNavigate()
  const selectBook = useStore((state) => state.selectBook)

  const {
    books,
    connectionStatus,
    isLoading,
    error,
    mountBookshelf,
  } = useBookshelf()

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

  // 点击书籍卡片
  const handleBookClick = useCallback((bookId: string) => {
    selectBook(bookId)
    navigate(`/reader/${bookId}`)
  }, [selectBook, navigate])

  // 导航到设置页
  const handleSettingsClick = useCallback(() => {
    navigate('/settings')
  }, [navigate])

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

    // 已连接但书架为空
    if (connectionStatus === 'connected' && books.length === 0) {
      return renderEmptyState()
    }

    // 已连接且有书
    return (
      <div className="mx-auto max-w-7xl pb-20">
        <BookGrid books={books} onBookClick={handleBookClick} />
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
      {connectionStatus === 'connected' && books.length > 0 && (
        <LibrarianBar files={bookFiles} />
      )}
    </div>
  )
}
