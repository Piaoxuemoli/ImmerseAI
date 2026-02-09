// ============================================
// RAG Worker 消息协议类型定义
// 渲染进程和 Worker 共享此文件
// ============================================

// ---- 基础数据结构 ----

/** EPUB 章节数据 */
export interface Chapter {
  title: string
  text: string
  cfi: string
}

/** 语义检索结果 */
export interface SearchResult {
  text: string
  cfi: string
  chapter: string
  score: number
}

// ---- Worker 接收的消息 (Renderer → Worker) ----

export interface IngestMessage {
  type: 'ingest'
  bookId: string
  chapters: Chapter[]
}

export interface SearchMessage {
  type: 'search'
  bookId: string
  query: string
  topK?: number
  requestId?: string
}

export interface StatusMessage {
  type: 'status'
  bookId: string
  requestId?: string
}

export interface PingMessage {
  type: 'ping'
}

/** 渲染进程发送给 Worker 的所有消息类型 */
export type WorkerMessage =
  | IngestMessage
  | SearchMessage
  | StatusMessage
  | PingMessage

// ---- Worker 返回的响应 (Worker → Renderer) ----

export interface IngestProgressResponse {
  type: 'ingest:progress'
  bookId: string
  progress: number // 0-100
}

export interface IngestCompleteResponse {
  type: 'ingest:complete'
  bookId: string
  chunkCount: number
}

export interface SearchResultResponse {
  type: 'search:result'
  results: SearchResult[]
  requestId?: string
}

export interface StatusResultResponse {
  type: 'status:result'
  bookId: string
  isIndexed: boolean
  requestId?: string
}

export interface PongResponse {
  type: 'pong'
}

export interface ErrorResponse {
  type: 'error'
  message: string
}

/** Worker 返回给渲染进程的所有响应类型 */
export type WorkerResponse =
  | IngestProgressResponse
  | IngestCompleteResponse
  | SearchResultResponse
  | StatusResultResponse
  | PongResponse
  | ErrorResponse
