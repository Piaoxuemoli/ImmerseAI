import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useStore } from '@/shared/store'
import { ModeToggle } from './ModeToggle'

interface ReaderHeaderProps {
  bookId: string
  onPersonaClick?: () => void
  /** Whether a background semantic upgrade is in progress */
  isUpgrading?: boolean
  /** 0-100 during upgrade, null when idle */
  upgradeProgress?: number | null
}

export function ReaderHeader({
  bookId,
  onPersonaClick,
  isUpgrading = false,
  upgradeProgress = null,
}: ReaderHeaderProps) {
  const navigate = useNavigate()
  const books = useStore((s) => s.books)
  const activePersonaId = useStore((s) => s.activePersonaId)
  const personas = useStore((s) => s.personas)
  const indexingProgress = useStore((s) => s.indexingProgress)

  const book = books.find((b) => b.id === bookId)
  const activePersona = activePersonaId
    ? personas.find((p) => p.id === activePersonaId && p.bookId === bookId)
    : undefined

  // ingest progress: shown while the initial index is being built
  const ingestProgress = indexingProgress[bookId] ?? null
  const isIndexing = ingestProgress !== null

  return (
    <div className="flex flex-col border-b border-slate-200 bg-white">
      {/* Main header row */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: back button */}
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

        {/* Center: book title */}
        <div className="flex-1 text-center">
          <span className="text-sm font-medium text-slate-900 line-clamp-1">
            {book?.title ?? '未知书籍'}
          </span>
        </div>

        {/* Right: persona button + mode toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs text-slate-600"
            title="选择角色"
            onClick={onPersonaClick}
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

      {/* Progress bars — at most one shown at a time */}
      {isIndexing && (
        <IndexingBar progress={ingestProgress} label="正在建立索引" />
      )}
      {!isIndexing && isUpgrading && upgradeProgress !== null && (
        <IndexingBar progress={upgradeProgress} label="语义增强中" subtle />
      )}
    </div>
  )
}

function IndexingBar({
  progress,
  label,
  subtle = false,
}: {
  progress: number
  label: string
  subtle?: boolean
}) {
  return (
    <div className={`px-4 pb-1.5 ${subtle ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-slate-400">{label}</span>
        <span className="text-[10px] text-slate-400">{progress}%</span>
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${subtle ? 'bg-indigo-400' : 'bg-indigo-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
