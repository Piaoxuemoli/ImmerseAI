/**
 * 内容缓存管理器
 *
 * 在 MCP readFile 之上加缓存层，加速大文档二次加载
 * - 内存缓存（刷新即失效）
 * - readFile 失败时清除缓存
 * - LRU 淘汰策略
 */

interface CacheEntry {
  content: string
  lastAccess: number
  size: number
}

const MAX_CACHE_SIZE = 50 * 1024 * 1024 // 50MB 内存限制
const MAX_ENTRIES = 10

export class ContentCache {
  private cache = new Map<string, CacheEntry>()
  private totalSize = 0

  private makeKey(bookId: string, bookPath: string): string {
    return `${bookId}:${bookPath}`
  }

  /**
   * 获取缓存内容
   * @returns 缓存内容，或 null 表示无缓存
   */
  get(bookId: string, bookPath: string): string | null {
    const key = this.makeKey(bookId, bookPath)
    const entry = this.cache.get(key)

    if (!entry) return null

    // 更新访问时间
    entry.lastAccess = Date.now()
    return entry.content
  }

  /**
   * 设置缓存
   */
  set(bookId: string, bookPath: string, content: string): void {
    const key = this.makeKey(bookId, bookPath)
    const size = new Blob([content]).size

    // 淘汰旧条目直到有空间
    while (this.cache.size >= MAX_ENTRIES || this.totalSize + size > MAX_CACHE_SIZE) {
      this.evictOldest()
    }

    // 删除旧条目（如果存在）
    if (this.cache.has(key)) {
      this.totalSize -= this.cache.get(key)!.size
    }

    this.cache.set(key, {
      content,
      lastAccess: Date.now(),
      size,
    })
    this.totalSize += size
  }

  /**
   * 删除缓存条目
   */
  delete(bookId: string, bookPath: string): void {
    const key = this.makeKey(bookId, bookPath)
    const entry = this.cache.get(key)
    if (entry) {
      this.totalSize -= entry.size
      this.cache.delete(key)
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.totalSize = 0
  }

  /**
   * 淘汰最旧的条目
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess
        oldestKey = key
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)
      if (entry) {
        this.totalSize -= entry.size
      }
      this.cache.delete(oldestKey)
    }
  }
}

// 单例
export const contentCache = new ContentCache()
