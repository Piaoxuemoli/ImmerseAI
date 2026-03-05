// ============================================
// 书籍元数据
// ============================================
export interface Book {
  id: string // UUID v4
  title: string // 书名
  author: string // 作者
  path: string // 本地绝对路径 (通过 MCP 获取)
  coverUrl?: string // 封面图 Base64 或本地路径
  isIndexed: boolean // 是否已完成向量化索引
  indexedAt?: number // 索引完成时间戳
  lastReadAt?: number // 上次阅读时间戳
  lastReadParagraphIndex?: number // 上次阅读段落索引
  lastReadOffset?: number // 上次阅读字符偏移（可选）
  chunkCount?: number // 索引片段总数
}

// ============================================
// 角色设定
// ============================================
export interface Persona {
  id: string // UUID v4
  bookId: string // 关联的书籍 ID
  name: string // 角色名称
  description: string // 用户输入的简述 / LLM 生成的摘要
  personality: string // 性格特征
  speechStyle: string // 说话风格
  background: string // 背景故事
  keyQuotes: string[] // 代表性台词
  systemPrompt: string // 最终生成的完整 System Prompt
  avatar?: string // 头像 (可选, emoji 或图片路径)
  createdAt: number // 创建时间
  updatedAt: number // 更新时间
}

// ============================================
// 聊天消息
// ============================================
export interface MessageMetadata {
  type: 'note-confirmation' | 'note-error'
  filePath?: string | undefined // 笔记文件路径
  noteTitle?: string | undefined // 笔记标题
  error?: string | undefined // 错误信息
}

export interface Message {
  id: string // UUID v4
  role: 'user' | 'assistant' | 'system'
  content: string // 消息内容 (支持 Markdown)
  timestamp: number // 发送时间戳
  personaId?: string // 关联的角色 ID (assistant 消息)
  citations?: Citation[] // 引用来源 (用于点击跳转到原文)
  metadata?: MessageMetadata // 笔记等特殊消息元数据
}

export interface Citation {
  paragraphIndex: number // 段落索引（用于阅读器跳转）
  offset?: number // 可选字符偏移
  text: string // 原文片段
  score: number // 相似度分数 (0-1)
}

// ============================================
// 对话会话
// ============================================
export interface ChatSession {
  id: string // UUID v4
  bookId: string // 关联书籍
  personaId: string // 关联角色
  messages: Message[] // 消息列表
  createdAt: number
  updatedAt: number
}

// ============================================
// LLM 配置
// ============================================
export interface LlmConfig {
  baseUrl?: string // API 端点（OpenAI 兼容）
  model?: string
  stream?: boolean // 是否启用流式响应，默认 true
}

/**
 * Store 中持久化的 LLM 配置（不含 apiKey）
 */
export interface StoreLlmConfig {
  baseUrl: string // 允许为空字符串，表示尚未配置
  model: string // 允许为空字符串，表示尚未配置
}

// ============================================
// 应用配置
// ============================================
export interface AppConfig {
  llm: {
    apiKey: string // 加密存储在 safeStorage 中
    baseUrl: string // API 端点（OpenAI 兼容）
    model: string // 模型名称
  }
  bookshelf: {
    rootPath: string // 书架根目录
    sourceType: 'local' | 'github'
  }
  ui: {
    theme: 'light' | 'dark' // 未来扩展
    fontSize: number // 阅读器字号
  }
}

// ============================================
// MCP 相关类型
// ============================================
export interface BookFile {
  name: string // 文件名
  path: string // 相对路径
  size: number // 文件大小 (bytes)
  type: 'epub' | 'pdf' | 'md' | 'txt' | 'directory' | 'unknown'
  lastModified: number // 最后修改时间
}

// ============================================
// Librarian Agent 类型
// ============================================

/**
 * Agent 意图类型
 */
export type AgentIntent = 'list_files' | 'move_file' | 'create_directory' | 'delete_file' | 'unknown'

/**
 * Agent 操作历史记录
 */
export interface AgentOperation {
  id: string // UUID v4
  timestamp: number // 操作时间戳
  intent: AgentIntent // 识别到的意图
  input: string // 用户原始输入
  params: Record<string, string> // 操作参数
  result: 'success' | 'error' // 操作结果
  message: string // 结果消息
  duration: number // 操作耗时 (ms)
}

/**
 * 意图识别结果
 */
export interface IntentRecognitionResult {
  intent: AgentIntent
  params: Record<string, string>
}

// ============================================
// 全局状态接口 (Zustand Store)
// ============================================
export interface ImmerseStore {
  // === 书架状态 ===
  books: Book[]
  selectedBookId: string | null
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'

  // === 阅读器状态 ===
  currentParagraphIndex: number | null // 当前段落索引
  currentOffset: number | null // 当前字符偏移（可选）
  readerMode: 'read' | 'chat'

  // === 角色状态 ===
  personas: Persona[]
  activePersonaId: string | null

  // === 对话状态 ===
  currentSession: ChatSession | null
  isGenerating: boolean

  // === RAG 状态 ===
  indexingProgress: Record<string, number> // bookId -> 0-100

  // === 设置状态 ===
  llmConfig: StoreLlmConfig
  bookshelfRootPath: string

  // === 笔记状态 ===
  lastNotePath: string | null

  // === 引用跳转状态 ===
  pendingCitationParagraphIndex: number | null
  pendingCitationOffset: number | null

  // === Librarian Agent 状态 ===
  agentHistory: AgentOperation[] // 最多 10 条操作历史

  // === Actions ===
  setBooks: (books: Book[]) => void
  selectBook: (bookId: string) => void
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void

  setCurrentParagraphIndex: (index: number | null) => void
  setCurrentOffset: (offset: number | null) => void
  toggleMode: () => void
  setReaderMode: (mode: 'read' | 'chat') => void

  setPersonas: (personas: Persona[]) => void
  setPersona: (persona: Persona) => void
  setActivePersona: (personaId: string | null) => void
  removePersona: (personaId: string) => void

  setCurrentSession: (session: ChatSession | null) => void
  addMessage: (message: Message) => void
  setIsGenerating: (generating: boolean) => void

  setIndexingProgress: (bookId: string, progress: number) => void
  clearIndexingProgress: (bookId: string) => void

  setLlmConfig: (config: Partial<StoreLlmConfig>) => void
  setBookshelfRootPath: (path: string) => void

  setPendingCitationParagraphIndex: (index: number | null) => void
  setPendingCitationOffset: (offset: number | null) => void

  setLastNotePath: (path: string | null) => void

  // === Librarian Agent Actions ===
  addAgentOperation: (operation: AgentOperation) => void
  clearAgentHistory: () => void
}
