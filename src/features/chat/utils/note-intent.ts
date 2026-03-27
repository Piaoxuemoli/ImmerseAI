/**
 * 笔记意图检测工具
 *
 * 通过正则匹配识别用户消息中的记笔记意图，
 * 零延迟，不需要额外 LLM 调用。
 */

export interface NoteIntentResult {
  isNote: boolean
  isAppend: boolean
  topic?: string | undefined
}

/** 记笔记动作关键词（中文） */
const NOTE_PATTERNS_ZH = [
  /记笔记/,
  /做笔记/,
  /记一下/,
  /写笔记/,
  /帮我记/,
  /做个笔记/,
  /记个笔记/,
]

/** 追加模式关键词 */
const APPEND_PATTERNS = [
  /追加/,
  /补充/,
  /继续记/,
]

/** 记笔记动作关键词（英文，大小写不敏感） */
const NOTE_PATTERNS_EN = [
  /take\s+(?:a\s+)?note/i,
  /note\s+this/i,
  /write\s+(?:a\s+)?note/i,
]

/**
 * 从用户消息中提取主题
 * 尝试匹配"关于XXX"、"about XXX"等模式
 */
function extractTopic(message: string): string | undefined {
  // 中文：关于/有关 + 内容
  const zhMatch = message.match(/(?:关于|有关|主题[是为：:])\s*[「「""]?(.+?)[」」""]?\s*(?:的笔记|的内容|$)/u)
  if (zhMatch?.[1]) {
    return zhMatch[1].trim()
  }

  // 英文：about + content
  const enMatch = message.match(/(?:about|on|regarding)\s+["']?(.+?)["']?\s*$/i)
  if (enMatch?.[1]) {
    return enMatch[1].trim()
  }

  // 尝试提取"记笔记"后面的内容作为主题
  const afterNoteMatch = message.match(/(?:记笔记|做笔记|写笔记|帮我记)[：:,，]?\s*(.+)/u)
  if (afterNoteMatch?.[1]) {
    const candidate = afterNoteMatch[1].trim()
    // 排除过长的内容（可能是正文而非主题）
    if (candidate.length > 0 && candidate.length <= 50) {
      return candidate
    }
  }

  return undefined
}

/**
 * 检测用户消息是否包含记笔记意图
 *
 * @param message - 用户输入的消息文本
 * @returns NoteIntentResult - 包含是否为笔记、是否追加、主题
 */
export function detectNoteIntent(message: string): NoteIntentResult {
  const trimmed = message.trim()
  if (trimmed.length === 0) {
    return { isNote: false, isAppend: false }
  }

  // 检测中文笔记意图
  const isZhNote = NOTE_PATTERNS_ZH.some((pattern) => pattern.test(trimmed))
  // 检测英文笔记意图
  const isEnNote = NOTE_PATTERNS_EN.some((pattern) => pattern.test(trimmed))

  const isNote = isZhNote || isEnNote

  if (!isNote) {
    return { isNote: false, isAppend: false }
  }

  // 检测追加模式
  const isAppend = APPEND_PATTERNS.some((pattern) => pattern.test(trimmed))

  // 提取主题
  const topic = extractTopic(trimmed)

  return { isNote: true, isAppend, topic }
}
