/**
 * Librarian Agent 服务层
 *
 * 负责：
 * - 调用 LLM 识别用户意图
 * - 解析 JSON 输出
 * - 编排 MCP 工具调用
 */

import type { Message, AgentIntent, AgentOperation, BookFile, LlmConfig } from '@/shared/types'
import { buildLibrarianSystemPrompt } from '../utils/librarian-prompt'
import { createLlmStream } from '@/shared/utils/llm-stream'

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
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('/')
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
 * @param availableFiles - 当前书架可用的文件名列表
 * @param llmConfig - 当前 LLM 配置（baseUrl、model）
 * @returns 识别到的意图和参数
 */
export async function recognizeIntent(
  userInput: string,
  availablePaths: string[],
  llmConfig: LlmConfig,
): Promise<IntentRecognitionResult> {
  const systemPrompt = buildLibrarianSystemPrompt(availablePaths)

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
 * @returns 执行结果
 */
export async function executeLibrarianCommand(
  userInput: string,
  bookshelfPath: string,
  files: BookFile[],
  llmConfig: LlmConfig,
): Promise<AgentExecuteResult> {
  const startTime = Date.now()

  // Step 1: 意图识别
  const availablePaths = files.map((f) => f.path)
  const intentResult = await recognizeIntent(userInput, availablePaths, llmConfig)

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
    return await executeMoveFile(intentResult.params, bookshelfPath, baseOperation, startTime)
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
 * 执行列出文件操作
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
    const books = entries.filter((entry) => entry.type !== 'directory')
    const message = `目录 ${targetPath}：${folders.length} 个文件夹，${books.length} 本书`

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
