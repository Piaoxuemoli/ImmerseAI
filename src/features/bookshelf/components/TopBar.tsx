import { Settings, Download, Github } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'

export function TopBar() {
  const navigate = useNavigate()

  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
      {/* Logo */}
      <h1 className="text-xl font-semibold text-slate-900">ImmerseAI</h1>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <Settings className="h-5 w-5 text-slate-500" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => {}}>
          <Download className="h-5 w-5 text-slate-500" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => {}}>
          <Github className="h-5 w-5 text-slate-500" />
        </Button>
      </div>
    </header>
  )
}
