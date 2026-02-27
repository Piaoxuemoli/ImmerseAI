import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle2, XCircle, FolderOpen } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { useStore } from '@/shared/store'

/**
 * 掩码显示 API Key：保留前 3 位和后 4 位
 */
function maskApiKey(key: string): string {
  if (key.length <= 7) return '••••••••'
  return `${key.slice(0, 3)}${'•'.repeat(8)}${key.slice(-4)}`
}

// ============================================
// 测试连接状态
// ============================================
type ConnectionTestStatus = 'idle' | 'testing' | 'success' | 'error'

export function SettingsPage() {
  const navigate = useNavigate()

  // Store 状态
  const llmConfig = useStore((s) => s.llmConfig)
  const bookshelfRootPath = useStore((s) => s.bookshelfRootPath)
  const setLlmConfig = useStore((s) => s.setLlmConfig)
  const setBookshelfRootPath = useStore((s) => s.setBookshelfRootPath)

  // API Key 本地状态（不进入 Store）
  const [apiKeyDisplay, setApiKeyDisplay] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [isApiKeyLoaded, setIsApiKeyLoaded] = useState(false)
  const [apiKeySaved, setApiKeySaved] = useState(false)

  // 测试连接状态
  const [testStatus, setTestStatus] = useState<ConnectionTestStatus>('idle')
  const [testError, setTestError] = useState('')

  // ============================================
  // 页面加载：从 safeStorage 读取 API Key
  // ============================================
  useEffect(() => {
    async function loadApiKey(): Promise<void> {
      try {
        const key = await window.electronAPI.app.getSafeStorage('llm_api_key')
        if (key) {
          setApiKeyDisplay(maskApiKey(key))
        }
      } catch {
        console.warn('[Settings] Failed to load API key from safeStorage')
      } finally {
        setIsApiKeyLoaded(true)
      }
    }
    void loadApiKey()
  }, [])

  // ============================================
  // API Key 保存
  // ============================================
  const handleSaveApiKey = useCallback(async () => {
    if (!apiKeyInput.trim()) return
    try {
      const saved = await window.electronAPI.app.setSafeStorage('llm_api_key', apiKeyInput.trim())
      if (saved) {
        setApiKeyDisplay(maskApiKey(apiKeyInput.trim()))
        setApiKeyInput('')
        setApiKeySaved(true)
        setTimeout(() => setApiKeySaved(false), 3000)
      }
    } catch {
      console.warn('[Settings] Failed to save API key')
    }
  }, [apiKeyInput])

  // ============================================
  // 测试连接
  // ============================================
  const handleTestConnection = useCallback(async () => {
    setTestStatus('testing')
    setTestError('')

    try {
      const testMessages = [{ id: 'test', role: 'user' as const, content: 'ping', timestamp: Date.now() }]
      const testConfig = {
        baseUrl: llmConfig.baseUrl,
        model: llmConfig.model,
        stream: true,
      }

      const stream = await window.electronAPI.llm.chat(testMessages, testConfig)
      const reader = stream.getReader()

      // 超时 10 秒
      const timeoutId = setTimeout(() => {
        reader.cancel().catch(() => {})
        setTestStatus('error')
        setTestError('连接超时 (10s)')
      }, 10000)

      const { done } = await reader.read()
      clearTimeout(timeoutId)
      reader.cancel().catch(() => {})

      if (!done) {
        setTestStatus('success')
      } else {
        setTestStatus('success') // 即使收到空的 done，说明连接成功
      }
    } catch (err) {
      setTestStatus('error')
      setTestError(err instanceof Error ? err.message : '连接失败')
    }
  }, [llmConfig])

  // ============================================
  // 更换书架目录
  // ============================================
  const handleChangeDirectory = useCallback(async () => {
    try {
      const dir = await window.electronAPI.app.selectDirectory()
      if (dir) {
        setBookshelfRootPath(dir)
      }
    } catch {
      console.warn('[Settings] Failed to select directory')
    }
  }, [setBookshelfRootPath])

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* ============================================ */}
      {/* Header */}
      {/* ============================================ */}
      <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-slate-500" />
        </Button>
        <h1 className="text-xl font-semibold text-slate-900">设置</h1>
      </header>

      {/* ============================================ */}
      {/* Content */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* ======================================== */}
          {/* LLM 配置区 */}
          {/* ======================================== */}
          <Card>
            <CardHeader>
              <CardTitle>LLM 配置</CardTitle>
              <CardDescription>配置 AI 模型的连接参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* API Key */}
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={
                      isApiKeyLoaded
                        ? apiKeyDisplay || '输入 API Key...'
                        : '加载中...'
                    }
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => void handleSaveApiKey()}
                    disabled={!apiKeyInput.trim()}
                    size="sm"
                  >
                    {apiKeySaved ? '已保存 ✓' : '保存'}
                  </Button>
                </div>
                {apiKeyDisplay && !apiKeyInput && (
                  <p className="text-xs text-slate-400">
                    已存储: {apiKeyDisplay}
                  </p>
                )}
              </div>

              {/* Base URL */}
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  value={llmConfig.baseUrl}
                  onChange={(e) => setLlmConfig({ baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
                <p className="text-xs text-slate-400">
                  OpenAI 兼容端点
                </p>
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={llmConfig.model}
                  onChange={(e) => setLlmConfig({ model: e.target.value })}
                  placeholder="gpt-4 / deepseek-chat / ..."
                />
              </div>

              <Separator />

              {/* 测试连接 */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => void handleTestConnection()}
                  disabled={testStatus === 'testing'}
                >
                  {testStatus === 'testing' && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  测试连接
                </Button>
                {testStatus === 'success' && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    连接成功
                  </span>
                )}
                {testStatus === 'error' && (
                  <span className="flex items-center gap-1 text-sm text-red-500">
                    <XCircle className="h-4 w-4" />
                    {testError || '连接失败'}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ======================================== */}
          {/* 书架配置区 */}
          {/* ======================================== */}
          <Card>
            <CardHeader>
              <CardTitle>书架</CardTitle>
              <CardDescription>管理本地书籍存放路径</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>书架路径</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {bookshelfRootPath || '未设置'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleChangeDirectory()}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    更换目录
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
