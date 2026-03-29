/**
 * Librarian Agent 服务层
 *
 * 负责：
 * - 调用 LLM 识别用户意图
 * - 解析 JSON 输出
 * - 编排 MCP 工具调用
 */

import type {
  Message,
  AgentIntent,
  AgentOperation,
  BookFile,
  LlmConfig,
  ExecutionPlan,
  ToolCallResult,
  SolidificationResult,
} from '@/shared/types'
import type { Skill, SkillStep } from '../types/skill'
import { WINDOWS_ABSOLUTE_PATH_RE } from '@/shared/utils/path'
import {
  buildLibrarianSystemPrompt,
  buildAgentSystemPromptV2,
  buildReActPrompt,
} from '../utils/librarian-prompt'
import { createLlmStream } from '@/shared/utils/llm-stream'
import { ToolRegistry, registerBuiltinTools } from './tool-registry'
import { SkillManager } from './skill-manager'

// MAX_REACT_STEPS for ReAct Loop
const MAX_REACT_STEPS = 10

// 初始化时注册所有 Tools
let toolsInitialized = false
function ensureToolsInitialized(): void {
  if (!toolsInitialized) {
    registerBuiltinTools()
    toolsInitialized = true
  }
}

// ============================================
// V2: ReAct Loop + Skill 路由
// ============================================

/**
 * 解析 LLM JSON 响应为 ExecutionPlan
 */
function parseExecutionPlan(response: string): ExecutionPlan {
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
    const parsed = JSON.parse(trimmed) as {
      type?: string
      name?: string
      params?: Record<string, unknown>
      thought?: string
      result?: string
      action?: {
        type?: string
        name?: string
        params?: Record<string, unknown>
      }
    }

    // 处理 skill 类型
    if (parsed.type === 'skill' && parsed.name) {
      return {
        type: 'skill',
        skillName: parsed.name,
        skillParams: parsed.params || {},
      }
    }

    // 处理 tool_call 类型
    if (parsed.type === 'tool_call' && parsed.action?.name) {
      return {
        type: 'tools',
        toolCalls: [{
          tool: parsed.action.name,
          args: parsed.action.params || {},
        }],
      }
    }

    // 处理 done 类型
    if (parsed.type === 'done') {
      return {
        type: 'done',
      }
    }

    // 处理 continue 类型
    if (parsed.type === 'continue') {
      return {
        type: 'tools',
        thought: parsed.thought,
      }
    }

    // 处理 ReAct 格式的响应
    if (parsed.action?.type === 'done') {
      return {
        type: 'done',
      }
    }

    if (parsed.action?.type === 'tool_call' && parsed.action?.name) {
      return {
        type: 'tools',
        thought: parsed.thought,
        toolCalls: [{
          tool: parsed.action.name,
          args: parsed.action.params || {},
        }],
      }
    }

    console.warn('[LibrarianAgent] Unknown execution plan type:', parsed)
    return { type: 'done' }
  } catch (error) {
    console.warn('[LibrarianAgent] Failed to parse execution plan:', error)
    return { type: 'done' }
  }
}

/**
 * 格式化工具执行结果为 LLM 上下文
 */
function formatObservation(result: ToolCallResult): string {
  if (!result.success) {
    return `Error: ${result.error || 'Unknown error'}`
  }

  const output = result.result
  if (output === null || output === undefined) {
    return 'Done (no output)'
  }

  if (typeof output === 'string') {
    return output
  }

  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

/**
 * 调用 LLM 决定下一步（ReAct Loop 决策）
 */
async function decideNextStep(
  userInput: string,
  history: Array<{ tool: string; observation: string }>,
  rootFolderNames: string[],
  llmConfig: LlmConfig,
): Promise<ExecutionPlan> {
  const toolSchemas = ToolRegistry.getInstance().getSchemas()
  const systemPrompt = buildReActPrompt(rootFolderNames, toolSchemas)

  const historyText = history
    .map((h, i) => `Step ${i + 1}: ${h.tool}\nObservation: ${h.observation}`)
    .join('\n\n')

  const messages: Message[] = [
    { id: crypto.randomUUID(), role: 'system', content: systemPrompt, timestamp: 0 },
    { id: crypto.randomUUID(), role: 'user', content: `User request: ${userInput}\n\nHistory:\n${historyText}`, timestamp: Date.now() },
  ]

  try {
    const stream = createLlmStream(messages, { ...llmConfig, temperature: 0.1, maxTokens: 512 })
    const reader = stream.getReader()
    let fullContent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) fullContent += value
    }
    return parseExecutionPlan(fullContent)
  } catch (error) {
    console.error('[LibrarianAgent] decideNextStep failed:', error)
    return { type: 'done' }
  }
}

/**
 * 格式化最终消息
 */
function formatFinalMessage(results: ToolCallResult[]): string {
  const lines: string[] = []
  for (const result of results) {
    if (!result.success) {
      lines.push(`[${result.tool}] Error: ${result.error}`)
    } else {
      const output = result.result
      if (output !== null && output !== undefined) {
        lines.push(`[${result.tool}] ${typeof output === 'string' ? output : JSON.stringify(output)}`)
      }
    }
  }
  return lines.join('\n') || 'Task completed.'
}

/**
 * 执行 Skill 的步骤
 */
async function executeSkill(
  skill: Skill,
  params: Record<string, unknown>,
  bookshelfPath: string,
  rootFolderNames: string[],
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = []

  for (const step of skill.steps) {
    // 解析参数：替换模板变量
    const args: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(step.params)) {
      // value 可以是实际值或者是 $paramName 形式的引用
      if (typeof value === 'string' && value.startsWith('$')) {
        const paramName = value.slice(1)
        args[key] = params[paramName] ?? value
      } else {
        args[key] = value
      }
    }

    // 如果参数包含相对路径，转换为绝对路径
    if (args.path && typeof args.path === 'string') {
      const normalizedPath = args.path.replace(/\\/g, '/').replace(/\/+/g, '/')
      if (!normalizedPath.startsWith('/') && !/^[a-zA-Z]:/.test(normalizedPath)) {
        args.path = `${bookshelfPath}/${normalizedPath}`.replace(/\/+/g, '/')
      }
    }

    if (args.source && typeof args.source === 'string') {
      const normalizedSource = args.source.replace(/\\/g, '/').replace(/\/+/g, '/')
      if (!normalizedSource.startsWith('/') && !/^[a-zA-Z]:/.test(normalizedSource)) {
        args.source = `${bookshelfPath}/${normalizedSource}`.replace(/\/+/g, '/')
      }
    }

    if (args.target && typeof args.target === 'string') {
      const normalizedTarget = args.target.replace(/\\/g, '/').replace(/\/+/g, '/')
      if (!normalizedTarget.startsWith('/') && !/^[a-zA-Z]:/.test(normalizedTarget)) {
        args.target = `${bookshelfPath}/${normalizedTarget}`.replace(/\/+/g, '/')
      }
    }

    console.log(`[LibrarianAgent] Executing skill step: ${step.tool}`, args)

    const result = await ToolRegistry.getInstance().execute(step.tool, args)
    results.push(result)

    if (!result.success && !result.isFinal) {
      // 步骤失败且不是最终步骤，终止执行
      console.warn(`[LibrarianAgent] Skill step failed: ${step.tool}`, result.error)
      break
    }
  }

  return results
}

/**
 * 意图识别 + 路由（V2）
 */
export async function recognizeAndRoute(
  userInput: string,
  availablePaths: string[],
  llmConfig: LlmConfig,
  rootFolderNames: string[] = [],
): Promise<ExecutionPlan> {
  ensureToolsInitialized()
  const skillManager = SkillManager.getInstance()
  await skillManager.loadAll()

  const toolSchemas = ToolRegistry.getInstance().getSchemas()
  const skillsPrompt = skillManager.getSystemPromptAddition()
  const systemPrompt = buildAgentSystemPromptV2(rootFolderNames, toolSchemas, skillsPrompt)

  const messages: Message[] = [
    { id: crypto.randomUUID(), role: 'system', content: systemPrompt, timestamp: 0 },
    { id: crypto.randomUUID(), role: 'user', content: userInput, timestamp: Date.now() },
  ]

  try {
    const stream = createLlmStream(messages, {
      ...llmConfig,
      temperature: 0.1,
      maxTokens: 1024,
    })
    const reader = stream.getReader()
    let fullContent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) fullContent += value
    }
    console.log('[LibrarianAgent] recognizeAndRoute raw response:', fullContent)
    return parseExecutionPlan(fullContent)
  } catch (error) {
    console.error('[LibrarianAgent] recognizeAndRoute failed:', error)
    return { type: 'done' }
  }
}

/**
 * ReAct Loop - 多步骤执行循环
 */
async function reactLoop(
  userInput: string,
  initialPlan: ExecutionPlan,
  bookshelfPath: string,
  rootFolderNames: string[],
  llmConfig: LlmConfig,
): Promise<ToolCallResult[]> {
  const history: Array<{ tool: string; observation: string }> = []
  let currentPlan = initialPlan
  let steps = 0

  while (steps < MAX_REACT_STEPS) {
    steps++

    // 如果没有 toolCalls，先尝试通过 decideNextStep 获取
    if (!currentPlan.toolCalls || currentPlan.toolCalls.length === 0) {
      if (currentPlan.type === 'done') {
        break
      }
      currentPlan = await decideNextStep(userInput, history, rootFolderNames, llmConfig)
      if (currentPlan.type === 'done' || !currentPlan.toolCalls || currentPlan.toolCalls.length === 0) {
        break
      }
    }

    // 执行工具调用
    const toolCalls = currentPlan.toolCalls
    const results = await ToolRegistry.getInstance().executeAll(toolCalls)

    // 记录观察结果
    for (const result of results) {
      history.push({
        tool: result.tool,
        observation: formatObservation(result),
      })
    }

    // 检查是否全部完成
    const allDone = results.every((r) => r.isFinal)
    if (allDone) {
      return results
    }

    // 决定下一步
    currentPlan = await decideNextStep(userInput, history, rootFolderNames, llmConfig)
    if (currentPlan.type === 'done') {
      return results
    }
  }

  console.warn(`[LibrarianAgent] ReAct Loop reached max steps (${MAX_REACT_STEPS})`)
  return []
}

/**
 * 固化判断 - 决定是否应将操作固化为 Skill
 */
async function judgeSolidification(
  taskDescription: string,
  executionSteps: SkillStep[],
  rootFolderNames: string[],
  llmConfig: LlmConfig,
): Promise<SolidificationResult> {
  const systemPrompt = `你是一个专业的 AI 助手，负责判断用户的操作是否可以泛化为可复用的 Skill。

## 四门判断标准（必须全部通过）
1. 重复性：这个任务是否可能重复发生？
2. 模式化：这个任务的步骤是否可以被模板化？
3. 价值性：固化为 Skill 后是否能显著提升效率？
4. 安全性：固化的步骤是否安全，不会造成数据损失？

## 用户的原始任务
${taskDescription}

## 实际执行步骤
${executionSteps.map((s, i) => `${i + 1}. ${s.tool}: ${s.description}`).join('\n')}

## 输出格式（严格 JSON）
{
  "shouldSolidify": true | false,
  "reason": "判断理由",
  "skillName": "建议的 skill 名称（kebab-case，仅当 shouldSolidify 为 true 时）",
  "generalizedDescription": "泛化后的描述（仅当 shouldSolidify 为 true 时）",
  "paramTemplate": {
    "参数名": { "type": "string", "description": "参数描述" }
  },
  "steps": [
    { "tool": "工具名", "description": "步骤描述", "params": {} }
  ]
}`

  const messages: Message[] = [
    { id: crypto.randomUUID(), role: 'system', content: systemPrompt, timestamp: 0 },
    { id: crypto.randomUUID(), role: 'user', content: '请判断上述操作是否应该固化为 Skill。', timestamp: Date.now() },
  ]

  try {
    const stream = createLlmStream(messages, {
      ...llmConfig,
      temperature: 0.1,
      maxTokens: 1024,
    })
    const reader = stream.getReader()
    let fullContent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) fullContent += value
    }

    let trimmed = fullContent.trim()
    if (trimmed.startsWith('```json')) trimmed = trimmed.slice(7)
    if (trimmed.endsWith('```')) trimmed = trimmed.slice(0, -3)
    trimmed = trimmed.trim()

    const parsed = JSON.parse(trimmed) as {
      shouldSolidify?: boolean
      reason?: string
      skillName?: string
      generalizedDescription?: string
      paramTemplate?: Record<string, { type: string; description: string }>
      steps?: SkillStep[]
    }

    return {
      shouldSolidify: parsed.shouldSolidify ?? false,
      reason: parsed.reason ?? 'Unknown',
      skillName: parsed.skillName,
      generalizedDescription: parsed.generalizedDescription,
      paramTemplate: parsed.paramTemplate,
      steps: parsed.steps,
    }
  } catch (error) {
    console.error('[LibrarianAgent] judgeSolidification failed:', error)
    return {
      shouldSolidify: false,
      reason: `Error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * 异步固化并保存 Skill
 */
async function judgeAndSaveSkill(
  taskDescription: string,
  executionSteps: SkillStep[],
  rootFolderNames: string[],
  llmConfig: LlmConfig,
): Promise<void> {
  try {
    const result = await judgeSolidification(taskDescription, executionSteps, rootFolderNames, llmConfig)

    if (!result.shouldSolidify) {
      console.log('[LibrarianAgent] Skill solidification skipped:', result.reason)
      return
    }

    if (!result.skillName || !result.generalizedDescription || !result.steps) {
      console.warn('[LibrarianAgent] Solidification result incomplete:', result)
      return
    }

    const skill: Skill = {
      name: result.skillName,
      description: result.generalizedDescription,
      适用条件: [],
      paramTemplate: result.paramTemplate || {},
      steps: result.steps,
      constraints: [],
    }

    const skillManager = SkillManager.getInstance()
    await skillManager.saveSkill(skill)
    console.log('[LibrarianAgent] Skill saved:', skill.name)
  } catch (error) {
    console.error('[LibrarianAgent] judgeAndSaveSkill failed:', error)
  }
}

/**
 * 执行 Librarian Agent 命令（V2 - 新入口）
 */
export async function executeLibrarianCommandV2(
  userInput: string,
  bookshelfPath: string,
  files: BookFile[],
  llmConfig: LlmConfig,
  rootFolders: BookFile[] = [],
): Promise<{
  success: boolean
  message: string
  skillExecuted?: boolean
}> {
  ensureToolsInitialized()

  const availablePaths = files.map((f) => f.path)
  const rootFolderNames = rootFolders.map((f) => f.name)

  // Step 1: 意图识别 + 路由
  const plan = await recognizeAndRoute(userInput, availablePaths, llmConfig, rootFolderNames)

  // Step 2: 根据 plan 类型执行
  if (plan.type === 'skill' && plan.skillName) {
    // Skill 命中
    const skillManager = SkillManager.getInstance()
    const skill = skillManager.get(plan.skillName)

    if (!skill) {
      return {
        success: false,
        message: `Skill not found: ${plan.skillName}`,
      }
    }

    const results = await executeSkill(skill, plan.skillParams || {}, bookshelfPath, rootFolderNames)
    const message = formatFinalMessage(results)
    const allSuccess = results.every((r) => r.success)

    // 异步固化判断
    if (allSuccess && results.length > 0) {
      const steps: SkillStep[] = skill.steps.map((s) => ({
        tool: s.tool,
        description: s.description,
        params: s.params,
      }))
      judgeAndSaveSkill(userInput, steps, rootFolderNames, llmConfig)
    }

    return {
      success: allSuccess,
      message,
      skillExecuted: true,
    }
  }

  if (plan.type === 'tools') {
    // 工具调用 - 进入 ReAct Loop
    const results = await reactLoop(userInput, plan, bookshelfPath, rootFolderNames, llmConfig)
    const message = formatFinalMessage(results)
    const allSuccess = results.every((r) => r.success)

    // 异步固化判断（仅在多步骤执行时）
    if (allSuccess && results.length > 1) {
      const steps: SkillStep[] = results.map((r) => ({
        tool: r.tool,
        description: `Executed ${r.tool}`,
        params: r.args,
      }))
      judgeAndSaveSkill(userInput, steps, rootFolderNames, llmConfig)
    }

    return {
      success: allSuccess,
      message,
      skillExecuted: false,
    }
  }

  // done 或未知
  return {
    success: true,
    message: 'Task completed.',
  }
}

// ============================================
// V1: 原有实现（保留兼容）
// ============================================

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
