import { BookOpen, MessageCircle, Columns2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useStore } from '@/shared/store'

export function ModeToggle() {
  const readerMode = useStore((s) => s.readerMode)
  const setReaderMode = useStore((s) => s.setReaderMode)

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
      <Button
        variant={readerMode === 'read' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setReaderMode('read')}
        title="阅读模式"
      >
        <BookOpen className="h-4 w-4" />
      </Button>
      <Button
        variant={readerMode === 'split' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setReaderMode('split')}
        title="分屏模式"
      >
        <Columns2 className="h-4 w-4" />
      </Button>
      <Button
        variant={readerMode === 'chat' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setReaderMode('chat')}
        title="对话模式"
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
    </div>
  )
}
