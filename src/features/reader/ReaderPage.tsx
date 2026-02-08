import { useParams } from 'react-router-dom'

export function ReaderPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-4xl font-semibold text-slate-900">Reader</h1>
        <p className="mt-4 text-slate-500">Book ID: {id}</p>
        <p className="mt-2 text-sm text-slate-400">Phase 3-4 will implement EPUB reader and AI chat</p>
      </div>
    </div>
  )
}
