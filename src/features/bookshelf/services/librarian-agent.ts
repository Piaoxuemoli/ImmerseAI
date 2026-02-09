/**
 * Librarian Agent 服务层
 *
 * 负责：
 * - 调用 LLM 识别用户意图
 * - 解析 JSON 输出
 * - 编排 MCP 工具调用
 */

import type { Message, AgentIntent, AgentOperation, BookFile } from '@/shared/types'
import { buildLibrarianSystemPrompt } from '../utils/librarian-prompt'
import { resolvePath, buildTargetPath } from '../utils/path-resolver'

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
 * @returns 识别到的意图和参数
 */
export async function recognizeIntent(
  userInput: string,
  availableFiles: string[],
): Promise<IntentRecognitionResult> {
  const systemPrompt = buildLibrarianSystemPrompt(availableFiles)

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
    const stream = await window.electronAPI.llm.chat(messages, {
      stream: true,
      temperature: 0.1, // 低温度保证输出稳定
      maxTokens: 256, // 只需要简短的 JSON 输出
    })
    const reader = stream.getReader()

    let fullContent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        fullContent += value
      }
    }

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
 * @returns 执行结果
 */
export async function executeLibrarianCommand(
  userInput: string,
  bookshelfPath: string,
  files: BookFile[],
): Promise<AgentExecuteResult> {
  const startTime = Date.now()

  // Step 1: 意图识别
  const fileNames = files.map((f) => f.name)
  const intentResult = await recognizeIntent(userInput, fileNames)

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
      message: '抱歉，我无法理解您的指令。支持的操作：列出文件、移动文件、创建目录、删除文件。',
      operation: {
        ...baseOperation,
        result: 'error',
        message: '无法识别意图',
        duration: Date.now() - startTime,
      },
    }
  }

  if (intentResult.intent === 'list_files') {
    return await executeListFiles(bookshelfPath, baseOperation, startTime)
  }

  if (intentResult.intent === 'create_directory') {
    return await executeCreateDirectory(intentResult.params, bookshelfPath, baseOperation, startTime)
  }

  if (intentResult.intent === 'move_file') {
    return await executeMoveFile(intentResult.params, bookshelfPath, files, baseOperation, startTime)
  }

  if (intentResult.intent === 'delete_file') {
    // 删除操作需要二次确认，先返回确认请求
    return handleDeleteConfirmation(intentResult.params, bookshelfPath, files, baseOperation, startTime)
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
  bookshelfPath: string,
  baseOperation: Partial<AgentOperation>,
  startTime: number,
): Promise<AgentExecuteResult> {
  try {
    const files = await window.electronAPI.mcp.listFiles(bookshelfPath)
    const fileNames = files.map((f) => f.name).join('、')
    const message = files.length > 0 ? `书架中共有 ${files.length} 本书：${fileNames}` : '书架为空'

    return {
      success: true,
      message,
      operation: {
        ...baseOperation,
        result: 'success',
        message,
        duration: Date.now() - startTime,
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '列出文件失败'
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
  const dirName = params.path?.replace(/文件夹|目录|分类/g, '').trim()

  if (!dirName) {
    return {
      success: false,
      message: '请指定要创建的目录名称',
      operation: {
        ...baseOperation,
        result: 'error',
        message: '缺少目录名称',
        duration: Date.now() - startTime,
      },
    }
  }

  const fullPath = `${bookshelfPath}/${dirName}`.replace(/\/+/g, '/')

  try {
    await window.electronAPI.mcp.createDirectory(fullPath)
    const message = `已创建目录：${dirName}`

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
    const errorMsg = error instanceof Error ? error.message : '创建目录失败'
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
  files: BookFile[],
  baseOperation: Partial<AgentOperation>,
  startTime: number,
): Promise<AgentExecuteResult> {
  const { source, target } = params

  if (!source) {
    return {
      success: false,
      message: '请指定要移动的文件',
      operation: {
        ...baseOperation,
        result: 'error',
        message: '缺少源文件',
        duration: Date.now() - startTime,
      },
    }
  }

  // 解析源文件路径
  const sourceResult = resolvePath(source, files, bookshelfPath)

  if (sourceResult.type === 'not_found') {
    return {
      success: false,
      message: `找不到文件：${source}`,
      operation: {
        ...baseOperation,
        result: 'error',
        message: `文件不存在: ${source}`,
        duration: Date.now() - startTime,
      },
    }
  }

  if (sourceResult.type === 'multiple') {
    return {
      success: false,
      message: `找到多个匹配的文件，请更具体指定：${sourceResult.candidates.join('、')}`,
      operation: {
        ...baseOperation,
        result: 'error',
        message: '路径歧义',
        duration: Date.now() - startTime,
      },
    }
  }

  const sourcePath = sourceResult.path
  const sourceFileName = sourcePath.split('/').pop() || ''

  // 构建目标路径
  const targetPath = target
    ? buildTargetPath(target, sourceFileName, bookshelfPath)
    : sourcePath

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
  files: BookFile[],
  baseOperation: Partial<AgentOperation>,
  startTime: number,
): AgentExecuteResult {
  const filePath = params.path

  if (!filePath) {
    return {
      success: false,
      message: '请指定要删除的文件',
      operation: {
        ...baseOperation,
        result: 'error',
        message: '缺少文件路径',
        duration: Date.now() - startTime,
      },
    }
  }

  // 解析文件路径
  const pathResult = resolvePath(filePath, files, bookshelfPath)

  if (pathResult.type === 'not_found') {
    return {
      success: false,
      message: `找不到文件：${filePath}`,
      operation: {
        ...baseOperation,
        result: 'error',
        message: `文件不存在: ${filePath}`,
        duration: Date.now() - startTime,
      },
    }
  }

  if (pathResult.type === 'multiple') {
    return {
      success: false,
      message: `找到多个匹配的文件，请更具体指定：${pathResult.candidates.join('、')}`,
      operation: {
        ...baseOperation,
        result: 'error',
        message: '路径歧义',
        duration: Date.now() - startTime,
      },
    }
  }

  const resolvedPath = pathResult.path
  const fileName = resolvedPath.split('/').pop() || filePath

  // 返回需要确认的状态
  return {
    success: true,
    message: `即将删除文件：${fileName}`,
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
    const fileName = filePath.split('/').pop() || filePath
    return {
      success: true,
      message: `已删除：${fileName}`,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '删除文件失败'
    return {
      success: false,
      message: errorMsg,
    }
  }
}
