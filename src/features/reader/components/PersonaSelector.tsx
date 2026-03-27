import { useEffect, useRef, useState } from 'react'
import { User, Check, Pencil, Trash2, Plus, ChevronDown } from 'lucide-react'
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
  const containerRef = useRef<HTMLDivElement>(null)

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

  const handleSelect = (personaId: string) => {
    setActivePersona(personaId)
    setOpen(false)
  }

  const handleDelete = (e: React.MouseEvent, persona: Persona) => {
    e.stopPropagation()
    if (window.confirm(`确认删除人格「${persona.name}」？`)) {
      removePersona(persona.id)
    }
  }

  const handleEdit = (e: React.MouseEvent, persona: Persona) => {
    e.stopPropagation()
    setOpen(false)
    onEditClick(persona)
  }

  const handleCreate = () => {
    setOpen(false)
    onCreateClick()
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
        onClick={() => setOpen((v) => !v)}
        title="选择角色"
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
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-background shadow-lg">
          {bookPersonas.length > 0 ? (
            <ul className="py-1">
              {bookPersonas.map((persona) => {
                const isActive = persona.id === activePersonaId
                return (
                  <li key={persona.id}>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                      onClick={() => handleSelect(persona.id)}
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
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        onClick={(e) => handleEdit(e, persona)}
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={(e) => handleDelete(e, persona)}
                        title="删除"
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
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={handleCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            新建角色
          </button>
        </div>
      )}
    </div>
  )
}
