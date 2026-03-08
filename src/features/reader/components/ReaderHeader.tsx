import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useStore } from '@/shared/store'
import type { Persona } from '@/shared/types'
import { ModeToggle } from './ModeToggle'
import { PersonaSelector } from './PersonaSelector'

interface ReaderHeaderProps {
  bookId: string
  onCreatePersonaClick?: () => void
  onEditPersonaClick?: (persona: Persona) => void
  /** Whether a background semantic upgrade is in progress */
  isUpgrading?: boolean
  /** 0-100 during upgrade, null when idle */
  upgradeProgress?: number | null
}

export function ReaderHeader({
  bookId,
  onCreatePersonaClick,
  onEditPersonaClick,
  isUpgrading = false,
  upgradeProgress = null,
}: ReaderHeaderProps) {
  const navigate = useNavigate()
  const books = useStore((s) => s.books)
  const indexingProgress = useStore((s) => s.indexingProgress)

  const book = books.find((b) => b.id === bookId)

  // ingest progress: shown while the initial index is being built
  const ingestProgress = indexingProgress[bookId] ?? null
  const isIndexing = ingestProgress !== null

  return (
    <div className="flex flex-col border-b border-border bg-background">
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
          <span className="text-sm font-medium text-foreground line-clamp-1">
            {book?.title ?? '未知书籍'}
          </span>
        </div>

        {/* Right: persona selector + mode toggle */}
        <div className="flex items-center gap-2">
          <PersonaSelector
            bookId={bookId}
            onCreateClick={onCreatePersonaClick ?? (() => {})}
            onEditClick={onEditPersonaClick ?? (() => {})}
          />
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
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${subtle ? 'bg-indigo-400' : 'bg-indigo-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
