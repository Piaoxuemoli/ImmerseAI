/**
 * Librarian Agent 服务层
 *
 * 负责：
 * - 调用 LLM 识别用户意图
 * - 解析 JSON 输出
 * - 编排 MCP 工具调用
 */

import type { Message, AgentIntent, AgentOperation, BookFile, LlmConfig } from '@/shared/types'
import { WINDOWS_ABSOLUTE_PATH_RE } from '@/shared/utils/path'
import { buildLibrarianSystemPrompt } from '../utils/librarian-prompt'
import { createLlmStream } from '@/shared/utils/llm-stream'
import { ToolRegistry, registerBuiltinTools } from './tool-registry'

// 初始化时注册所有 Tools
let toolsInitialized = false
function ensureToolsInitialized(): void {
  if (!toolsInitialized) {
    registerBuiltinTools()
    toolsInitialized = true
  }
}

/**
 * 意图识别结果
 */
export interface IntentRecognitionResult {
  intent: AgentIntent
  params: Record<string, string>
}

/**
 * Agent 执行结果
 */
export interface AgentExecuteResult {
  success: boolean
  message: string
  operation: Partial<AgentOperation>
  needsConfirmation?: boolean
  confirmationData?: {
    intent: 'delete_file'
    path: string
    fileName: string
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}

function isAbsolutePath(path: string): boolean {
  return WINDOWS_ABSOLUTE_PATH_RE.test(path) || path.startsWith('/')
}

function toAbsolutePath(inputPath: string, bookshelfPath: string): string {
  const normalizedInput = normalizePath(inputPath).replace(/^[./]+/, '')
  if (isAbsolutePath(normalizedInput)) return normalizedInput
  return normalizePath(`${bookshelfPath}/${normalizedInput}`)
}

function fileNameFromPath(path: string): string {
  const normalized = normalizePath(path).replace(/\/$/, '')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || normalized
}

function isRootDirectChildPath(rootPath: string, targetPath: string): boolean {
  const normalizedRoot = normalizePath(rootPath).replace(/\/+$/, '')
  const normalizedTarget = normalizePath(targetPath).replace(/\/+$/, '')
  if (!normalizedTarget.startsWith(`${normalizedRoot}/`)) return false
  const relative = normalizedTarget.slice(normalizedRoot.length + 1)
  if (!relative || relative.includes('/')) return false
  return true
}

/**
 * 从 LLM 响应中解析 JSON
 */
function parseJsonResponse(response: string): IntentRecognitionResult {
  // 尝试直接解析
  let trimmed = response.trim()

  // 移除可能的 markdown 代码块标记
  if (trimmed.startsWith('```json')) {
    trimmed = trimmed.slice(7)
  } else if (trimmed.startsWith('```')) {
    trimmed = trimmed.slice(3)
  }
  if (trimmed.endsWith('```')) {
    trimmed = trimmed.slice(0, -3)
  }

  trimmed = trimmed.trim()

  try {
    const parsed = JSON.parse(trimmed) as { intent?: string; params?: Record<string, string> }
    const intent = parsed.intent as AgentIntent
    const validIntents: AgentIntent[] = [
      'list_files',
      'move_file',
      'create_directory',
      'delete_file',
      'unknown',
    ]

    if (!validIntents.includes(intent)) {
      return { intent: 'unknown', params: {} }
    }

    return {
      intent,
      params: parsed.params || {},
    }
  } catch {
    console.warn('[LibrarianAgent] Failed to parse LLM response as JSON:', response)
    return { intent: 'unknown', params: {} }
  }
}

/**
 * 调用 LLM 识别用户意图
 *
 * @param userInput - 用户输入的自然语言
 * @param availablePaths - 当前书架可用的书籍路径列表
 * @param llmConfig - 当前 LLM 配置（baseUrl、model）
 * @param rootFolderNames - 根目录下一级文件夹名称列表
 * @returns 识别到的意图和参数
 */
export async function recognizeIntent(
  userInput: string,
  availablePaths: string[],
  llmConfig: LlmConfig,
  rootFolderNames: string[] = [],
): Promise<IntentRecognitionResult> {
  const systemPrompt = buildLibrarianSystemPrompt(availablePaths, rootFolderNames)

  const messages: Message[] = [
    {
      id: crypto.randomUUID(),
      role: 'system',
      content: systemPrompt,
      timestamp: 0,
    },
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    },
  ]

  try {
    const stream = createLlmStream(messages, {
      ...llmConfig,
      stream: true,
      temperature: 0.1,
      maxTokens: 256,
    })
    const reader = stream.getReader()
    let fullContent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) fullContent += value
    }
    console.log('[LibrarianAgent] Raw LLM response:', JSON.stringify(fullContent))
    return parseJsonResponse(fullContent)
  } catch (error) {
    console.error('[LibrarianAgent] Intent recognition failed:', error)
    return { intent: 'unknown', params: {} }
  }
}

/**
 * 执行 Librarian Agent 命令
 *
 * @param userInput - 用户原始输入
 * @param bookshelfPath - 书架根目录路径
 * @param files - 当前书架文件列表
 * @param llmConfig - 当前 LLM 配置（baseUrl、model）
 * @param rootFolders - 根目录下一级文件夹列表
 * @returns 执行结果
 */
export async function executeLibrarianCommand(
  userInput: string,
  bookshelfPath: string,
  files: BookFile[],
  llmConfig: LlmConfig,
  rootFolders: BookFile[] = [],
): Promise<AgentExecuteResult> {
  const startTime = Date.now()

  // 确保 Tools 已注册
  ensureToolsInitialized()

  // Step 1: 意图识别（附带一级文件夹上下文）
  const availablePaths = files.map((f) => f.path)
  const rootFolderNames = rootFolders.map((f) => f.name)
  const intentResult = await recognizeIntent(userInput, availablePaths, llmConfig, rootFolderNames)

  const baseOperation: Partial<AgentOperation> = {
    id: crypto.randomUUID(),
    timestamp: startTime,
    intent: intentResult.intent,
    input: userInput,
    params: intentResult.params,
  }

  // Step 2: 处理不同意图
  if (intentResult.intent === 'unknown') {
    return {
      success: false,
      message: '抱歉，我无法理解您的指令。支持的操作：列出目录、移动书籍、创建文件夹、删除文件夹。',
      operation: {
        ...baseOperation,
        result: 'error',
        message: '无法识别意图',
        duration: Date.now() - startTime,
      },
    }
  }

  if (intentResult.intent === 'list_files') {
    return await executeListFiles(intentResult.params, bookshelfPath, baseOperation, startTime)
  }

  if (intentResult.intent === 'create_directory') {
    return await executeCreateDirectory(intentResult.params, bookshelfPath, baseOperation, startTime)
  }

  if (intentResult.intent === 'move_file') {
    return await executeMoveFile(intentResult.params, bookshelfPath, rootFolderNames, baseOperation, startTime)
  }

  if (intentResult.intent === 'delete_file') {
    // 删除文件夹操作需要二次确认
    return handleDeleteConfirmation(intentResult.params, bookshelfPath, baseOperation, startTime)
  }

  return {
    success: false,
    message: '未支持的操作类型',
    operation: {
      ...baseOperation,
      result: 'error',
      message: '未支持的操作',
      duration: Date.now() - startTime,
    },
  }
}

/**
 * 执行列出文件操作（自动展开子文件夹）
 */
async function executeListFiles(
  params: Record<string, string>,
  bookshelfPath: string,
  baseOperation: Partial<AgentOperation>,
  startTime: number,
): Promise<AgentExecuteResult> {
  try {
    const targetPath = params.path ? toAbsolutePath(params.path, bookshelfPath) : bookshelfPath
    const entries = await window.electronAPI.mcp.listFiles(targetPath)
    const folders = entries.filter((entry) => entry.type === 'directory')
    const rootBooks = entries.filter((entry) => entry.type !== 'directory')

    const lines: string[] = []

    if (folders.length === 0 && rootBooks.length === 0) {
      lines.push('（目录为空）')
    } else {
      // 当前目录下的散文件（通常根目录不应有书籍，但兜底展示）
      if (rootBooks.length > 0) {
        lines.push(`📄 根目录书籍（${rootBooks.length} 本）：`)
        for (const book of rootBooks) {
          lines.push(`  - ${book.name}`)
        }
      }

      // 并行展开每个子文件夹
      const folderResults = await Promise.allSettled(
        folders.map((f) => window.electronAPI.mcp.listFiles(f.path))
      )
      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i]
        const subEntries: typeof entries =
          folderResults[i].status === 'fulfilled' ? folderResults[i].value : []
        const subBooks = subEntries.filter((e) => e.type !== 'directory')
        if (subBooks.length > 0) {
          lines.push(`📁 ${folder.name}（${subBooks.length} 本）：`)
          for (const book of subBooks) {
            lines.push(`  - ${book.name}`)
          }
        } else {
          lines.push(`📁 ${folder.name}（空）`)
        }
      }
    }

    const message = lines.join('\n')

    return {
      success: true,
      message,
      operation: {
        ...baseOperation,
        params: { path: targetPath },
        result: 'success',
        message,
        duration: Date.now() - startTime,
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '列出目录失败'
    return {
      success: false,
      message: errorMsg,
      operation: {
        ...baseOperation,
        result: 'error',
        message: errorMsg,
        duration: Date.now() - startTime,
      },
    }
  }
}

/**
 * 执行创建目录操作
 */
async function executeCreateDirectory(
  params: Record<string, string>,
  bookshelfPath: string,
  baseOperation: Partial<AgentOperation>,
  startTime: number,
): Promise<AgentExecuteResult> {
  const directoryPathInput = params.path?.trim()
  if (!directoryPathInput) {
    return {
      success: false,
      message: '请提供要创建的文件夹路径',
      operation: {
        ...baseOperation,
        result: 'error',
        message: '缺少路径参数 path',
        duration: Date.now() - startTime,
      },
    }
  }

  const fullPath = toAbsolutePath(directoryPathInput, bookshelfPath)
  if (!isRootDirectChildPath(bookshelfPath, fullPath)) {
    return {
      success: false,
      message: '仅支持在根目录创建一级子文件夹',
      operation: {
        ...baseOperation,
        result: 'error',
        message: '不允许嵌套创建目录',
        duration: Date.now() - startTime,
      },
    }
  }

  try {
    await window.electronAPI.mcp.createDirectory(fullPath)
    const message = `已创建文件夹：${fullPath}`

    return {
      success: true,
      message,
      operation: {
        ...baseOperation,
        params: { ...baseOperation.params, path: fullPath },
        result: 'success',
        message,
        duration: Date.now() - startTime,
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '创建文件夹失败'
    return {
      success: false,
      message: errorMsg,
      operation: {
        ...baseOperation,
        result: 'error',
        message: errorMsg,
        duration: Date.now() - startTime,
      },
    }
  }
}

/**
 * 执行移动文件操作
 */
async function executeMoveFile(
  params: Record<string, string>,
  bookshelfPath: string,
  rootFolderNames: string[],
  baseOperation: Partial<AgentOperation>,
  startTime: number,
): Promise<AgentExecuteResult> {
  const { source, target } = params

  if (!source || !target) {
    return {
      success: false,
      message: '请同时提供 source 和 target 路径',
      operation: {
        ...baseOperation,
        result: 'error',
        message: '缺少 source/target 参数',
        duration: Date.now() - startTime,
      },
    }
  }

  const sourcePath = toAbsolutePath(source, bookshelfPath)
  const sourceFileName = fileNameFromPath(sourcePath)
  const targetPath = /\.(md|txt)$/i.test(target)
    ? toAbsolutePath(target, bookshelfPath)
    : toAbsolutePath(`${target}/${sourceFileName}`, bookshelfPath)

  // 预校验目标文件夹是否存在（仅对相对路径中的一级文件夹名做校验）
  if (rootFolderNames.length > 0) {
    const targetFolderName = normalizePath(target).replace(/^[./]+/, '').split('/')[0]
    const targetIsAbsolute = isAbsolutePath(normalizePath(target).replace(/^[./]+/, ''))
    if (!targetIsAbsolute && targetFolderName && !rootFolderNames.includes(targetFolderName)) {
      const message = `目标文件夹"${targetFolderName}"不存在。当前可用文件夹：${rootFolderNames.join('、')}。请先创建该文件夹，或选择已有文件夹。`
      return {
        success: false,
        message,
        operation: {
          ...baseOperation,
          result: 'error',
          message,
          duration: Date.now() - startTime,
        },
      }
    }
  }

  try {
    await window.electronAPI.mcp.moveFile(sourcePath, targetPath)
    const message = `已移动：${sourceFileName} → ${targetPath}`

    return {
      success: true,
      message,
      operation: {
        ...baseOperation,
        params: { source: sourcePath, target: targetPath },
        result: 'success',
        message,
        duration: Date.now() - startTime,
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '移动文件失败'
    return {
      success: false,
      message: errorMsg,
      operation: {
        ...baseOperation,
        result: 'error',
        message: errorMsg,
        duration: Date.now() - startTime,
      },
    }
  }
}

/**
 * 处理删除文件确认（返回确认请求而非直接执行）
 */
function handleDeleteConfirmation(
  params: Record<string, string>,
  bookshelfPath: string,
  baseOperation: Partial<AgentOperation>,
  startTime: number,
): AgentExecuteResult {
  const folderPathInput = params.path?.trim()

  if (!folderPathInput) {
    return {
      success: false,
      message: '请提供要删除的文件夹路径',
      operation: {
        ...baseOperation,
        result: 'error',
        message: '缺少路径参数 path',
        duration: Date.now() - startTime,
      },
    }
  }

  const resolvedPath = toAbsolutePath(folderPathInput, bookshelfPath)
  const fileName = fileNameFromPath(resolvedPath)

  // 返回需要确认的状态
  return {
    success: true,
    message: `即将删除文件夹：${fileName}`,
    needsConfirmation: true,
    confirmationData: {
      intent: 'delete_file',
      path: resolvedPath,
      fileName,
    },
    operation: {
      ...baseOperation,
      params: { path: resolvedPath },
      result: 'success',
      message: '等待确认',
      duration: Date.now() - startTime,
    },
  }
}

/**
 * 执行删除文件（用户确认后调用）
 *
 * @param filePath - 要删除的文件完整路径
 * @returns 执行结果
 */
export async function executeDeleteFile(filePath: string): Promise<{ success: boolean; message: string }> {
  try {
    await window.electronAPI.mcp.deleteFile(filePath)
    const fileName = fileNameFromPath(filePath)
    return {
      success: true,
      message: `已删除文件夹：${fileName}`,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '删除文件夹失败'
    return {
      success: false,
      message: errorMsg,
    }
  }
}
