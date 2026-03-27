/**
 * 路径解析工具
 *
 * 将 LLM 提取的模糊文件名转换为完整路径
 */

import type { BookFile } from '@/shared/types'

/**
 * 路径解析结果
 */
export type PathResolveResult =
  | { type: 'single'; path: string }
  | { type: 'multiple'; candidates: string[] }
  | { type: 'not_found' }

/**
 * 规范化字符串用于模糊匹配
 * - 转小写
 * - 移除空格和常见标点
 * - 移除文件扩展名
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\.(epub|pdf|txt)$/i, '')
    .replace(/[\s\-_,.，。、]+/g, '')
}

/**
 * 解析模糊路径为完整文件路径
 *
 * @param partial - LLM 提取的部分文件名或路径
 * @param files - 书架中的文件列表
 * @param bookshelfPath - 书架根目录
 * @returns 解析结果
 */
export function resolvePath(
  partial: string,
  files: BookFile[],
  bookshelfPath: string,
): PathResolveResult {
  if (!partial || partial.trim() === '') {
    return { type: 'not_found' }
  }

  const normalizedPartial = normalize(partial)
  const candidates: string[] = []

  for (const file of files) {
    const normalizedName = normalize(file.name)

    // 精确匹配（规范化后）
    if (normalizedName === normalizedPartial) {
      return { type: 'single', path: file.path }
    }

    // 前缀匹配
    if (normalizedName.startsWith(normalizedPartial)) {
      candidates.push(file.path)
    }

    // 包含匹配（作为备选）
    if (normalizedName.includes(normalizedPartial)) {
      if (!candidates.includes(file.path)) {
        candidates.push(file.path)
      }
    }
  }

  if (candidates.length === 1) {
    // 安全访问：已确认 length === 1
    const singlePath = candidates[0]
    if (singlePath) {
      return { type: 'single', path: singlePath }
    }
  }

  if (candidates.length > 1) {
    return { type: 'multiple', candidates }
  }

  // 如果没有找到，尝试将 partial 视为相对路径
  const fullPath = partial.startsWith(bookshelfPath)
    ? partial
    : `${bookshelfPath}/${partial}`.replace(/\/+/g, '/')

  // 检查是否存在于文件列表中
  const exists = files.some((f) => f.path === fullPath || f.path === partial)
  if (exists) {
    return { type: 'single', path: fullPath }
  }

  return { type: 'not_found' }
}

/**
 * 构建新文件的目标路径
 *
 * @param directory - 目标目录（可能是用户说的 "科幻文件夹"）
 * @param fileName - 源文件名
 * @param bookshelfPath - 书架根目录
 * @returns 完整目标路径
 */
export function buildTargetPath(
  directory: string,
  fileName: string,
  bookshelfPath: string,
): string {
  // 清理目录名
  const cleanDir = directory
    .replace(/文件夹|目录|分类/g, '')
    .trim()
    .replace(/^[/\\]+|[/\\]+$/g, '')

  // 构建完整路径
  const targetDir = cleanDir ? `${bookshelfPath}/${cleanDir}` : bookshelfPath
  const targetPath = `${targetDir}/${fileName}`.replace(/\/+/g, '/')

  return targetPath
}
