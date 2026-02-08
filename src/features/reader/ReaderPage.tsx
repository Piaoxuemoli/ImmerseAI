import { useParams } from 'react-router-dom'
import { useStore } from '@/shared/store'
import { ChatInterface } from '@/features/chat/components/ChatInterface'

export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const readerMode = useStore((s) => s.readerMode)

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Header placeholder — will be replaced by ReaderHeader */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="text-sm font-medium text-slate-900">Book: {id}</span>
        <span className="text-xs text-slate-400">
          Mode: {readerMode === 'read' ? '📖 阅读' : '💬 对话'}
        </span>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        {readerMode === 'read' ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-semibold text-slate-900">Reader</h1>
              <p className="mt-4 text-slate-500">EPUB viewer coming soon</p>
            </div>
          </div>
        ) : (
          <ChatInterface />
        )}
      </div>
    </div>
  )
}
