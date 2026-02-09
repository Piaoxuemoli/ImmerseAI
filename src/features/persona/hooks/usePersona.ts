import { useState, useCallback, useRef } from 'react'
import { useStore } from '@/shared/store'
import type { Persona } from '@/shared/types'
import { generatePersona as generatePersonaService } from '@/features/chat/services/persona-generator'

// ============================================
// Form 状态类型
// ============================================
interface PersonaForm {
  name: string
  description: string
  personality: string
  speechStyle: string
  background: string
  keyQuotesText: string // 每行一句台词，保存时按 \n 分割
}

type PersonaFormField = keyof PersonaForm

const INITIAL_FORM: PersonaForm = {
  name: '',
  description: '',
  personality: '',
  speechStyle: '',
  background: '',
  keyQuotesText: '',
}

// ============================================
// usePersona Hook
// ============================================
export function usePersona(bookId: string) {
  const [form, setForm] = useState<PersonaForm>({ ...INITIAL_FORM })
  const [isGenerating, setIsGenerating] = useState(false)
  const [nameError, setNameError] = useState(false)

  // 编辑模式：保留原角色的 id 和 createdAt
  const editingRef = useRef<{ id: string; createdAt: number } | null>(null)

  // 保存最近一次生成返回的 systemPrompt
  const lastSystemPromptRef = useRef<string>('')

  const setPersona = useStore((s) => s.setPersona)
  const setActivePersona = useStore((s) => s.setActivePersona)

  // ---- setField ----
  const setField = useCallback((field: PersonaFormField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'name' && value.trim() !== '') {
      setNameError(false)
    }
  }, [])

  // ---- generatePersona ----
  const generatePersona = useCallback(async () => {
    if (form.name.trim() === '') {
      setNameError(true)
      return
    }

    setIsGenerating(true)
    try {
      const result = await generatePersonaService(bookId, form.name.trim())
      lastSystemPromptRef.current = result.systemPrompt
      setForm((prev) => ({
        ...prev,
        personality: result.personality,
        speechStyle: result.speechStyle,
        background: result.background,
        keyQuotesText: result.keyQuotes.join('\n'),
        // 仅在描述为空时自动填充
        description: prev.description || result.description,
      }))
    } catch {
      // 生成失败时不修改表单，保留用户已输入的值
    } finally {
      setIsGenerating(false)
    }
  }, [bookId, form.name])

  // ---- savePersona ----
  const savePersona = useCallback((): boolean => {
    if (form.name.trim() === '') {
      setNameError(true)
      return false
    }

    const now = Date.now()
    const isEditing = editingRef.current !== null

    const persona: Persona = {
      id: isEditing ? editingRef.current!.id : crypto.randomUUID(),
      bookId,
      name: form.name.trim(),
      description: form.description.trim(),
      personality: form.personality.trim(),
      speechStyle: form.speechStyle.trim(),
      background: form.background.trim(),
      keyQuotes: form.keyQuotesText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== ''),
      systemPrompt: lastSystemPromptRef.current,
      createdAt: isEditing ? editingRef.current!.createdAt : now,
      updatedAt: now,
    }

    setPersona(persona)
    setActivePersona(persona.id)
    return true
  }, [bookId, form, setPersona, setActivePersona])

  // ---- loadPersona ----
  const loadPersona = useCallback((persona: Persona) => {
    editingRef.current = { id: persona.id, createdAt: persona.createdAt }
    setForm({
      name: persona.name,
      description: persona.description,
      personality: persona.personality,
      speechStyle: persona.speechStyle,
      background: persona.background,
      keyQuotesText: persona.keyQuotes.join('\n'),
    })
    setNameError(false)
  }, [])

  // ---- resetForm ----
  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_FORM })
    setNameError(false)
    editingRef.current = null
    lastSystemPromptRef.current = ''
  }, [])

  return {
    form,
    setField,
    isGenerating,
    nameError,
    generatePersona,
    savePersona,
    loadPersona,
    resetForm,
  }
}
