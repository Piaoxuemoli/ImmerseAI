/**
 * 笔记文件名构建工具
 *
 * 生成安全的文件名：{书名}-{YYYY-MM-DD}-{主题}.md
 * 保留中文字符、英文字母和数字，替换不安全字符
 */

/** 文件系统不安全字符 */
const UNSAFE_CHARS = /[/\\:*?"<>|]/g

/**
 * 将字符串转为文件名安全格式
 * - 替换不安全字符为 '-'
 * - 合并连续的 '-'
 * - 去除首尾 '-'
 * - 保留中文、英文、数字
 */
function sanitize(input: string): string {
  return input
    .replace(UNSAFE_CHARS, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .trim()
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 构建笔记文件名
 *
 * @param bookTitle - 书籍标题
 * @param topic - 笔记主题
 * @param date - 日期对象
 * @returns 安全的文件名，如 "三体-2026-02-09-黑暗森林法则.md"
 */
export function buildNoteFilename(bookTitle: string, topic: string, date: Date): string {
  const safeTitle = sanitize(bookTitle) || 'untitled'
  const safeTopic = sanitize(topic) || 'note'
  const dateStr = formatDate(date)
  return `${safeTitle}-${dateStr}-${safeTopic}.md`
}

/**
 * 构建笔记文件完整路径
 *
 * @param bookshelfPath - 书架根目录
 * @param filename - 笔记文件名
 * @returns 完整路径，如 "/books/notes/三体-2026-02-09-黑暗森林法则.md"
 */
export function buildNotePath(bookshelfPath: string, filename: string): string {
  // 确保路径使用正斜杠（MCP 文件系统兼容）
  const base = bookshelfPath.replace(/\\/g, '/')
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${normalizedBase}/notes/${filename}`
}
