import { ArrowUp } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'

export function LibrarianBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
        <Input
          placeholder="Ask Librarian..."
          className="flex-1"
          onKeyDown={() => {}}
        />
        <Button
          variant="default"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={() => {}}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
