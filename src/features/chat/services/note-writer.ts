/**
 * 笔记文件写入服务
 *
 * 通过 MCP writeFile 将笔记写入本地文件系统
 * 支持新建和追加模式
 */

import { buildNoteFilename, buildNotePath } from '../utils/note-filename'

export interface WriteNoteResult {
  success: boolean
  filePath: string
  error?: string
}

/**
 * 将笔记内容写入文件
 *
 * @param bookshelfPath - 书架根目录路径
 * @param bookTitle - 书籍标题
 * @param topic - 笔记主题
 * @param content - Markdown 笔记内容
 * @param append - 是否追加到已有文件
 * @param existingPath - 追加模式下的现有文件路径（可选）
 * @returns WriteNoteResult
 */
export async function writeNote(
  bookshelfPath: string,
  bookTitle: string,
  topic: string,
  content: string,
  append: boolean,
  existingPath?: string,
): Promise<WriteNoteResult> {
  // 确定文件路径
  const filename = buildNoteFilename(bookTitle, topic, new Date())
  const filePath = existingPath && append
    ? existingPath
    : buildNotePath(bookshelfPath, filename)

  try {
    if (append && existingPath) {
      // 追加模式：读取现有内容 → 拼接 → 覆写
      try {
        const existingBuffer = await window.electronAPI.mcp.readFile(existingPath)
        const decoder = new TextDecoder('utf-8')
        const existingContent = decoder.decode(existingBuffer)
        const combinedContent = `${existingContent}\n\n---\n\n${content}`
        await tryWriteWithRetry(existingPath, combinedContent, bookshelfPath)
      } catch {
        // 文件不存在，降级为新建模式
        await tryWriteWithRetry(filePath, content, bookshelfPath)
        return {
          success: true,
          filePath,
        }
      }
      return {
        success: true,
        filePath: existingPath,
      }
    }

    // 新建模式
    await tryWriteWithRetry(filePath, content, bookshelfPath)
    return {
      success: true,
      filePath,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return {
      success: false,
      filePath,
      error: errorMessage,
    }
  }
}

/**
 * 尝试写入文件，失败时尝试创建 notes/ 目录后重试
 */
async function tryWriteWithRetry(
  filePath: string,
  content: string,
  bookshelfPath: string,
): Promise<void> {
  try {
    await window.electronAPI.mcp.writeFile(filePath, content)
  } catch (firstError) {
    // 可能是 notes/ 目录不存在，尝试创建后重试
    const base = bookshelfPath.replace(/\\/g, '/')
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
    const notesDir = `${normalizedBase}/notes`

    try {
      // 通过写入一个临时标记文件来"确保"目录存在
      // MCP filesystem server 的 write_file 在某些配置下会自动创建父目录
      await window.electronAPI.mcp.writeFile(`${notesDir}/.keep`, '')
    } catch {
      // 忽略目录创建失败
    }

    // 重试写入
    await window.electronAPI.mcp.writeFile(filePath, content)
  }
}
