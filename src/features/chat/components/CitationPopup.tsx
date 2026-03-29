import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, BookOpen, ArrowRight } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import type { Citation } from '@/shared/types'

interface CitationPopupProps {
  citation: Citation
  onClose: () => void
  onJump?: (paragraphIndex: number, offset?: number) => void
}

export function CitationPopup({ citation, onClose, onJump }: CitationPopupProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Dismiss on click outside the panel
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  const handleJump = () => {
    onJump?.(citation.paragraphIndex, citation.offset)
    onClose()
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      {/* Frosted glass backdrop */}
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" />

      {/* Popup panel */}
      <div
        ref={panelRef}
        className="relative w-80 rounded-2xl border border-border bg-background/80 shadow-xl backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            <span>段落 {citation.paragraphIndex + 1}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5">
              {Math.round(citation.score * 100)}% 相关
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Citation text body */}
        <div className="max-h-52 overflow-y-auto px-4 py-3">
          <p className="text-sm leading-relaxed text-foreground">
            {citation.text}
          </p>
        </div>

        {/* Footer: jump action */}
        {onJump && (
          <div className="border-t border-border px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-between text-xs text-muted-foreground hover:text-foreground"
              onClick={handleJump}
            >
              <span>跳转到原文</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
