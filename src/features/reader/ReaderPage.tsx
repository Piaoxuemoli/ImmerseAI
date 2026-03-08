import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/shared/store'
import { ChatInterface } from '@/features/chat/components/ChatInterface'
import { PersonaConfigDialog } from '@/features/persona/components/PersonaConfigDialog'
import { checkBookIndexedStatus, splitContentToParagraphs } from '@/features/chat/services/persona-generator'
import { useRag } from '@/shared/hooks/useRag'
import { useReader } from './hooks/useReader'
import { ReaderHeader } from './components/ReaderHeader'
import { TextViewer } from './components/TextViewer'
import { ReadingLoadingSkeleton } from './components/ReadingLoadingSkeleton'

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
  const books = useStore((s) => s.books)
  const setBooks = useStore((s) => s.setBooks)
  const setActivePersona = useStore((s) => s.setActivePersona)
  const setCurrentSession = useStore((s) => s.setCurrentSession)
  const selectBook = useStore((s) => s.selectBook)
  const setIndexingProgress = useStore((s) => s.setIndexingProgress)
  const clearIndexingProgress = useStore((s) => s.clearIndexingProgress)
  const markBookIndexed = useStore((s) => s.markBookIndexed)
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false)

  const activePersona = useMemo(
    () => (activePersonaId ? personas.find((p) => p.id === activePersonaId && p.bookId === bookId) : undefined),
    [activePersonaId, bookId, personas],
  )

  const {
    content,
    loading,
    error,
    paragraphIndex,
    handleProgressChange,
  } = useReader(bookId)

  const book = books.find((b) => b.id === bookId)

  const { ingest, upgradeProgress, isUpgrading } = useRag({
    onIngestProgress: useCallback(
      (data) => {
        setIndexingProgress(data.bookId, data.progress)
      },
      [setIndexingProgress],
    ),
    onIngestComplete: useCallback(
      (data) => {
        markBookIndexed(data.bookId, data.contentHash, data.chunkCount)
        // Always clear ingest progress — upgrade progress is tracked separately
        clearIndexingProgress(data.bookId)
      },
      [markBookIndexed, clearIndexingProgress],
    ),
  })

  useEffect(() => {
    if (bookId) {
      selectBook(bookId)
    }
  }, [bookId, selectBook])

  useEffect(() => {
    const matchingPersona = personas.find((persona) => persona.bookId === bookId)
    if (!activePersonaId) {
      if (matchingPersona) {
        setActivePersona(matchingPersona.id)
      }
      return
    }

    const currentActivePersona = personas.find((persona) => persona.id === activePersonaId)
    if (!currentActivePersona || currentActivePersona.bookId !== bookId) {
      setActivePersona(matchingPersona?.id ?? null)
    }
  }, [activePersonaId, bookId, personas, setActivePersona])

  useEffect(() => {
    const currentSession = useStore.getState().currentSession
    if (currentSession && currentSession.bookId !== bookId) {
      setCurrentSession(null)
    }
  }, [bookId, setCurrentSession])

  useEffect(() => {
    // Read book from store directly inside the effect so that scroll-driven
    // setBooks() updates (which change the book object reference) do NOT
    // re-trigger this effect.  Only bookId / content / loading changes should
    // trigger a re-index attempt.
    const currentBook = useStore.getState().books.find((b) => b.id === bookId)
    if (!bookId || !currentBook || !content || loading) return

    let cancelled = false

    const ensureIndexed = async () => {
      // Always verify via IPC — the cache file may no longer exist after a
      // version upgrade even if book.contentHash is set in the store.
      const alreadyIndexed = await checkBookIndexedStatus(bookId)
      if (cancelled) return

      if (alreadyIndexed) {
        // Cache exists — update store to reflect indexed state
        const latestBook = useStore.getState().books.find((b) => b.id === bookId)
        if (latestBook && !latestBook.isIndexed) {
          setBooks(
            useStore.getState().books.map((b) =>
              b.id === bookId
                ? { ...b, isIndexed: true, indexedAt: b.indexedAt ?? Date.now() }
                : b,
            ),
          )
        }
        return
      }

      const paragraphs = splitContentToParagraphs(content)
      if (paragraphs.length === 0) return
      ingest(bookId, paragraphs)
    }

    void ensureIndexed()

    return () => {
      cancelled = true
    }
    // Intentionally excludes `book` — reading it via useStore.getState() inside
    // the effect prevents scroll-driven books updates from retriggering ingest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, content, ingest, loading, setBooks])

  return (
    <div className="flex h-screen flex-col bg-background">
      <ReaderHeader
        bookId={bookId}
        onPersonaClick={() => setPersonaDialogOpen(true)}
        isUpgrading={isUpgrading}
        upgradeProgress={upgradeProgress}
      />

      {error && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      )}

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
                {loading ? (
                  <ReadingLoadingSkeleton />
                ) : (
                  <TextViewer
                    content={content}
                    bookPath={book?.path ?? ''}
                    initialParagraphIndex={paragraphIndex}
                    onProgressChange={handleProgressChange}
                  />
                )}
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

      <PersonaConfigDialog
        open={personaDialogOpen}
        onOpenChange={setPersonaDialogOpen}
        bookId={bookId}
        bookTitle={book?.title ?? ''}
        existingPersona={activePersona}
      />
    </div>
  )
}
