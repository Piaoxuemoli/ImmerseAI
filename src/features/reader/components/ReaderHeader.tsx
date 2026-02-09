import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useStore } from '@/shared/store'
import { ModeToggle } from './ModeToggle'

interface ReaderHeaderProps {
  bookId: string
}

export function ReaderHeader({ bookId }: ReaderHeaderProps) {
  const navigate = useNavigate()
  const books = useStore((s) => s.books)
  const activePersonaId = useStore((s) => s.activePersonaId)
  const personas = useStore((s) => s.personas)

  const book = books.find((b) => b.id === bookId)
  const activePersona = activePersonaId
    ? personas.find((p) => p.id === activePersonaId)
    : undefined

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
      {/* 左侧：返回按钮 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => navigate('/bookshelf')}
          title="返回书架"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* 中间：书名 */}
      <div className="flex-1 text-center">
        <span className="text-sm font-medium text-slate-900 line-clamp-1">
          {book?.title ?? '未知书籍'}
        </span>
      </div>

      {/* 右侧：角色按钮 + 模式切换 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-xs text-slate-600"
          title="选择角色"
        >
          {activePersona ? (
            <>
              <span>{activePersona.avatar ?? '🎭'}</span>
              <span className="max-w-[60px] truncate">{activePersona.name}</span>
            </>
          ) : (
            <User className="h-4 w-4" />
          )}
        </Button>
        <ModeToggle />
      </div>
    </div>
  )
}
