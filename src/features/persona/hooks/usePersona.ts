import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useStore } from '@/shared/store'
import type { Persona } from '@/shared/types'
import { generatePersona as generatePersonaService } from '@/features/chat/services/persona-generator'

interface PersonaForm {
  name: string
}

// ============================================
// usePersona Hook
// ============================================
const INITIAL_FORM: PersonaForm = {
  name: '',
}

export function usePersona(bookId: string, bookTitle: string) {
  const [form, setForm] = useState<PersonaForm>({ ...INITIAL_FORM })
  const [isGenerating, setIsGenerating] = useState(false)
  const [nameError, setNameError] = useState(false)

  const setPersona = useStore((s) => s.setPersona)
  const setActivePersona = useStore((s) => s.setActivePersona)
  const llmConfig = useStore((s) => s.llmConfig)
  const personas = useStore((s) => s.personas)

  const setName = useCallback((value: string) => {
    setForm({ name: value })
    if (value.trim() !== '') {
      setNameError(false)
    }
  }, [])

  const loadPersona = useCallback((persona: Persona) => {
    setForm({ name: persona.name })
    setNameError(false)
  }, [])

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_FORM })
    setNameError(false)
  }, [])

  const generatePersona = useCallback(async (): Promise<boolean> => {
    if (form.name.trim() === '') {
      setNameError(true)
      return false
    }

    setIsGenerating(true)
    try {
      const name = form.name.trim()
      const result = await generatePersonaService(bookId, bookTitle, name, llmConfig)
      const now = Date.now()
      const existingPersona = personas.find(
        (persona) => persona.bookId === bookId && persona.name.trim() === name,
      )

      const persona: Persona = {
        id: existingPersona?.id ?? crypto.randomUUID(),
        bookId,
        name,
        description: result.description,
        personality: result.personality,
        speechStyle: result.speechStyle,
        background: result.background,
        keyQuotes: result.keyQuotes,
        systemPrompt: result.systemPrompt,
        createdAt: existingPersona?.createdAt ?? now,
        updatedAt: now,
      }

      setPersona(persona)
      setActivePersona(persona.id)
      toast.success(`已生成人物：${name}`)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '人物生成失败'
      toast.error(message)
      return false
    } finally {
      setIsGenerating(false)
    }
  }, [bookId, bookTitle, form.name, llmConfig, personas, setActivePersona, setPersona])

  return {
    form,
    setName,
    isGenerating,
    nameError,
    generatePersona,
    loadPersona,
    resetForm,
  }
}
