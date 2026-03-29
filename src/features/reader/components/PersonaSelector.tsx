import { useEffect, useRef, useState } from 'react'
import { User, Check, Pencil, Trash2, Plus, ChevronDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { useStore } from '@/shared/store'
import type { Persona } from '@/shared/types'

interface PersonaSelectorProps {
  bookId: string
  onCreateClick: () => void
  onEditClick: (persona: Persona) => void
}

export function PersonaSelector({ bookId, onCreateClick, onEditClick }: PersonaSelectorProps) {
  const personas = useStore((s) => s.personas)
  const activePersonaId = useStore((s) => s.activePersonaId)
  const setActivePersona = useStore((s) => s.setActivePersona)
  const removePersona = useStore((s) => s.removePersona)

  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [deleteTarget, setDeleteTarget] = useState<Persona | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const bookPersonas = personas.filter((p) => p.bookId === bookId)
  const activePersona = activePersonaId
    ? personas.find((p) => p.id === activePersonaId && p.bookId === bookId)
    : undefined

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + 1, bookPersonas.length)) // +1 for "create" option
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < bookPersonas.length) {
          handleSelect(bookPersonas[focusedIndex].id)
        } else if (focusedIndex === bookPersonas.length) {
          handleCreate()
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  const handleSelect = (personaId: string) => {
    setActivePersona(personaId)
    setOpen(false)
    setFocusedIndex(-1)
  }

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      removePersona(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  const handleEdit = (e: React.MouseEvent, persona: Persona) => {
    e.stopPropagation()
    setOpen(false)
    onEditClick(persona)
  }

  const handleCreate = () => {
    setOpen(false)
    setFocusedIndex(-1)
    onCreateClick()
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="选择角色"
      >
        {activePersona ? (
          <>
            <span>{activePersona.avatar ?? '🎭'}</span>
            <span className="max-w-[64px] truncate">{activePersona.name}</span>
          </>
        ) : (
          <User className="h-4 w-4" />
        )}
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label="角色列表"
          className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-background shadow-lg"
        >
          {bookPersonas.length > 0 ? (
            <ul ref={listRef} className="py-1">
              {bookPersonas.map((persona, index) => {
                const isActive = persona.id === activePersonaId
                return (
                  <li key={persona.id}>
                    <button
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:bg-muted ${
                        focusedIndex === index ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleSelect(persona.id)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      aria-selected={isActive}
                      role="option"
                    >
                      {/* Active check */}
                      <span className="w-4 shrink-0 text-center">
                        {isActive ? <Check className="h-3.5 w-3.5 text-foreground" /> : null}
                      </span>

                      {/* Avatar + name */}
                      <span className="shrink-0">{persona.avatar ?? '🎭'}</span>
                      <span className="flex-1 truncate text-foreground">{persona.name}</span>

                      {/* Edit */}
                      <button
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => handleEdit(e, persona)}
                        aria-label={`编辑角色 ${persona.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(persona)
                        }}
                        aria-label={`删除角色 ${persona.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground">暂无角色，请新建</p>
          )}

          {/* Divider + Create */}
          {bookPersonas.length > 0 && (
            <div className="border-t border-border" />
          )}
          <button
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:bg-muted ${
              focusedIndex === bookPersonas.length ? 'bg-muted text-foreground' : ''
            }`}
            onClick={handleCreate}
            onMouseEnter={() => setFocusedIndex(bookPersonas.length)}
            aria-label="新建角色"
          >
            <Plus className="h-3.5 w-3.5" />
            新建角色
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除角色</DialogTitle>
            <DialogDescription>
              确定要删除人格「{deleteTarget?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
