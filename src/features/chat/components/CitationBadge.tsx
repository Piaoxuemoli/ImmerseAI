import { Paperclip } from 'lucide-react'
import type { Citation } from '@/shared/types'

interface CitationBadgeProps {
  citation: Citation
  onClick?: () => void
}

export function CitationBadge({ citation, onClick }: CitationBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground ${
        onClick ? 'cursor-pointer hover:bg-accent' : 'cursor-default'
      }`}
    >
      <Paperclip className="h-3 w-3" />
      <span>段落 {citation.paragraphIndex}</span>
      <span className="text-muted-foreground">{Math.round(citation.score * 100)}%</span>
    </button>
  )
}
