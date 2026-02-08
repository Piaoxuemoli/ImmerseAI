# 数据模型规范

## 目的
定义 ImmerseAI 所有核心数据结构的 TypeScript 接口。

## 需求

### Requirement: Book 接口
系统 SHALL 使用以下接口表示书籍元数据：
- id: string (UUID v4)
- title: string
- author: string
- path: string (本地绝对路径)
- coverUrl?: string
- isIndexed: boolean
- indexedAt?: number
- lastReadAt?: number
- lastReadCfi?: string
- chunkCount?: number

### Requirement: Persona 接口
系统 SHALL 使用以下接口表示角色设定：
- id: string (UUID v4)
- bookId: string (关联书籍)
- name: string
- description: string
- personality: string
- speechStyle: string
- background: string
- keyQuotes: string[]
- systemPrompt: string (LLM 生成的完整 Prompt)
- avatar?: string
- createdAt: number
- updatedAt: number

### Requirement: Message 接口
系统 SHALL 使用以下接口表示聊天消息：
- id: string (UUID v4)
- role: 'user' | 'assistant' | 'system'
- content: string (支持 Markdown)
- timestamp: number
- personaId?: string
- citations?: Citation[]

### Requirement: Citation 接口
- cfi: string (epub 定位符)
- text: string (原文片段)
- chapter: string
- score: number (0-1 相似度)
