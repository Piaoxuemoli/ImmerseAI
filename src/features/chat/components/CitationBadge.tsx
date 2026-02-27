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
      className={`inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 ${
        onClick ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'
      }`}
    >
      <Paperclip className="h-3 w-3" />
      <span>段落 {citation.paragraphIndex}</span>
      <span className="text-slate-400">{Math.round(citation.score * 100)}%</span>
    </button>
  )
}
