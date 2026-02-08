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
  lastReadCfi?: string // 上次阅读位置 (epub CFI)
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
export interface Message {
  id: string // UUID v4
  role: 'user' | 'assistant' | 'system'
  content: string // 消息内容 (支持 Markdown)
  timestamp: number // 发送时间戳
  personaId?: string // 关联的角色 ID (assistant 消息)
  citations?: Citation[] // 引用来源 (用于点击跳转到原文)
}

export interface Citation {
  cfi: string // epub 定位符 (用于阅读器跳转)
  text: string // 原文片段
  chapter: string // 所属章节名
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
  provider?: 'deepseek' | 'kimi' | 'moonshot' | 'openai' | 'custom'
  model?: string
  temperature?: number // 0.0 - 1.0
  maxTokens?: number
  stream?: boolean // 是否启用流式响应，默认 true
}

// ============================================
// 应用配置
// ============================================
export interface AppConfig {
  llm: {
    provider: 'deepseek' | 'kimi' | 'moonshot' | 'openai' | 'custom'
    apiKey: string // 加密存储在 safeStorage 中
    baseUrl: string // API 端点
    model: string // 模型名称
    temperature: number // 0.0 - 1.0, 默认 0.7
    maxTokens: number // 最大生成长度, 默认 2048
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
  type: 'epub' | 'pdf' | 'txt' | 'unknown'
  lastModified: number // 最后修改时间
}
