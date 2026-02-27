import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/shared/store'
import { ChatInterface } from '@/features/chat/components/ChatInterface'
import { PersonaConfigDialog } from '@/features/persona/components/PersonaConfigDialog'
import { useReader } from './hooks/useReader'
import { ReaderHeader } from './components/ReaderHeader'
import { TextViewer } from './components/TextViewer'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = { duration: 0.15, ease: 'easeInOut' }

export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const bookId = id ?? ''
  const readerMode = useStore((s) => s.readerMode)
  const activePersonaId = useStore((s) => s.activePersonaId)
  const personas = useStore((s) => s.personas)
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false)

  const activePersona = activePersonaId
    ? personas.find((p) => p.id === activePersonaId)
    : undefined

  const {
    content,
    loading,
    error,
    paragraphIndex,
    handleProgressChange,
  } = useReader(bookId)

  const books = useStore((s) => s.books)
  const book = books.find((b) => b.id === bookId)

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <ReaderHeader bookId={bookId} onPersonaClick={() => setPersonaDialogOpen(true)} />

      {/* 错误状态 */}
      {error && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      {!error && (
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {readerMode === 'read' ? (
              <motion.div
                key="reader"
                className="h-full"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <TextViewer
                  content={loading ? '' : content}
                  bookPath={book?.path ?? ''}
                  initialParagraphIndex={paragraphIndex}
                  onProgressChange={handleProgressChange}
                />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                className="h-full"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <ChatInterface />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {/* 角色配置弹窗 */}
      <PersonaConfigDialog
        open={personaDialogOpen}
        onOpenChange={setPersonaDialogOpen}
        bookId={bookId}
        existingPersona={activePersona}
      />
    </div>
  )
}
