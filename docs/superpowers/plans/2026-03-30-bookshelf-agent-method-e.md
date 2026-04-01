# 书架 Agent 方案 E 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现书架 Agent 方案 E，从单步意图识别升级为支持 Tools 扩展 + ReAct Loop + Skills 积累的真正 Agent 调度能力

**Architecture:** 三层架构：
- Tools 层：原子操作注册表，10+ 工具可自由组合
- Agent 层：意图识别 + 路由 → ReAct Loop 多步执行 → 固化判断
- Skills 层：MD 文件存储，跨会话积累

**Tech Stack:** TypeScript + Electron + MCP (@modelcontextprotocol/sdk) + OpenAI SDK

---

## 文件结构

```
src/features/bookshelf/
├── services/
│   ├── librarian-agent.ts      # 修改：扩展为 ReAct Loop + Skill 路由
│   ├── tool-registry.ts        # 新增：Tool 注册表
│   └── skill-manager.ts        # 新增：Skill 加载/保存/查重
├── utils/
│   └── librarian-prompt.ts      # 修改：改为动态 Tools + Skills 的 System Prompt
├── types/
│   └── skill.ts                # 新增：Skill 类型定义

electron/main/
├── mcp-manager.ts              # 修改：新增 6 个 Tool 实现

skills/                              # 内置 Skills（进 git）
├── catalog.json

$USERDATA/skills/                    # 用户积累（不进 git）
├── catalog.json
```

---

## Task 1: 定义 Skill 和 Tool 类型

**Files:**
- Create: `src/features/bookshelf/types/skill.ts`
- Modify: `src/shared/types/index.ts` (添加新类型)

- [ ] **Step 1: 创建 Skill 类型定义文件**

```typescript
// src/features/bookshelf/types/skill.ts

/**
 * Skill 定义 - 从 MD 文件解析
 */
export interface Skill {
  name: string                    // kebab-case, 如 'move-books-between-folders'
  description: string             // 泛型描述，如"将文件夹 X 中的所有书籍移动到文件夹 Y"
 适用条件: string[]               // Agent 判断是否命中的条件列表
  paramTemplate: Record<string, { type: string; description: string }>  // 参数模板
  steps: SkillStep[]             // 执行步骤（模板形式）
  constraints: string[]          // 约束条件
}

/**
 * Skill 执行步骤
 */
export interface SkillStep {
  tool: string                   // 工具名，如 'move_file'
  description: string             // 步骤描述
  params: Record<string, string> // 参数模板，key 为参数名，value 为来源
}

/**
 * Skill 目录索引
 */
export interface SkillCatalog {
  version: number
  skills: string[]  // Skill 名称列表
}
```

- [ ] **Step 2: 添加 Agent 层新类型到 shared/types**

在 `AgentIntent` 后添加：

```typescript
/**
 * Agent 执行计划类型
 */
export type PlanType = 'skill' | 'tools' | 'done'

/**
 * 工具调用
 */
export interface ToolCall {
  tool: string
  args: Record<string, unknown>
}

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  tool: string
  args: Record<string, unknown>
  result: unknown
  success: boolean
  isFinal: boolean               // 是否为最终步骤
  error?: string
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  type: PlanType
  skillName?: string
  skillParams?: Record<string, unknown>
  thought?: string               // Agent 推理过程
  toolCalls?: ToolCall[]        // 要调用的工具
  maxSteps?: number
}

/**
 * 固化判断结果
 */
export interface SolidificationResult {
  shouldSolidify: boolean
  reason: string
  skillName?: string
  generalizedDescription?: string
  paramTemplate?: Record<string, { type: string; description: string }>
  steps?: SkillStep[]
}
```

- [ ] **Step 3: 提交**

```bash
git add src/features/bookshelf/types/skill.ts src/shared/types/index.ts
git commit -m "feat(bookshelf): 添加 Skill 和 Agent 执行计划类型"
```

---

## Task 2: 实现 Tool 注册表

**Files:**
- Create: `src/features/bookshelf/services/tool-registry.ts`
- Modify: `src/features/bookshelf/services/librarian-agent.ts`

- [ ] **Step 1: 创建 ToolRegistry 类**

```typescript
// src/features/bookshelf/services/tool-registry.ts

import type { ToolCall, ToolCallResult } from '@/shared/types'

/**
 * Tool 定义
 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  execute: (params: Record<string, unknown>) => Promise<ToolCallResult>
}

/**
 * Tool 注册表 - 单一实例
 */
export class ToolRegistry {
  private static instance: ToolRegistry | null = null
  private tools = new Map<string, ToolDefinition>()

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry()
    }
    return ToolRegistry.instance
  }

  /**
   * 注册 Tool
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * 获取 Tool
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * 获取所有 Tool
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /**
   * 执行 Tool 调用
   */
  async execute(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return {
        tool: toolName,
        args,
        result: null,
        success: false,
        isFinal: false,
        error: `Tool not found: ${toolName}`
      }
    }

    try {
      const result = await tool.execute(args)
      return result
    } catch (error) {
      return {
        tool: toolName,
        args,
        result: null,
        success: false,
        isFinal: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 批量执行 Tool 调用
   */
  async executeAll(calls: ToolCall[]): Promise<ToolCallResult[]> {
    return Promise.all(calls.map(call => this.execute(call.tool, call.args)))
  }

  /**
   * 导出给 LLM 的 tool schema 列表（OpenAI function calling 格式）
   */
  getSchemas(): object[] {
    return this.getAll().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }
    }))
  }
}
```

- [ ] **Step 2: 创建 Tool 工具函数（复用现有 MCP 调用）**

```typescript
// src/features/bookshelf/services/tool-definitions.ts
// 实现所有 Tool 的 execute 函数

import type { ToolCallResult } from '@/shared/types'
import { ToolRegistry } from './tool-registry'

/**
 * 创建 list_files Tool
 */
function createListFilesTool(): ToolDefinition {
  return {
    name: 'list_files',
    description: '列出指定目录下的所有文件和文件夹。可选递归。支持过滤。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径，默认为书架根目录' },
        recursive: { type: 'boolean', description: '是否递归列出子文件夹' }
      },
      required: []
    },
    execute: async (params) => {
      const { path, recursive } = params
      const targetPath = path as string || await window.electronAPI.mcp.listFiles(path as string)
      // 如果 recursive=true，需要展开子文件夹
      const entries = await window.electronAPI.mcp.listFiles(targetPath as string)
      if (recursive) {
        // 递归收集所有文件
        const allFiles: BookFile[] = []
        const collectFiles = async (dirPath: string) => {
          const items = await window.electronAPI.mcp.listFiles(dirPath)
          for (const item of items) {
            if (item.type === 'directory') {
              await collectFiles(item.path)
            } else {
              allFiles.push(item)
            }
          }
        }
        await collectFiles(targetPath as string)
        return { tool: 'list_files', args: params, result: allFiles, success: true, isFinal: true }
      }
      return { tool: 'list_files', args: params, result: entries, success: true, isFinal: true }
    }
  }
}

/**
 * 创建 get_file_content Tool
 */
function createGetFileContentTool(): ToolDefinition {
  return {
    name: 'get_file_content',
    description: '读取文件内容，返回文本前 N 个字符。用于查看文件内部内容。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件完整路径' },
        maxChars: { type: 'number', description: '最大读取字符数，默认 2000' }
      },
      required: ['path']
    },
    execute: async (params) => {
      const { path, maxChars = 2000 } = params
      try {
        const buffer = await window.electronAPI.mcp.readFile(path as string)
        const decoder = new TextDecoder()
        const content = decoder.decode(buffer as ArrayBuffer)
        const truncated = content.slice(0, maxChars as number)
        return {
          tool: 'get_file_content',
          args: params,
          result: { content: truncated, truncated: content.length > maxChars },
          success: true,
          isFinal: true
        }
      } catch (error) {
        return {
          tool: 'get_file_content',
          args: params,
          result: null,
          success: false,
          isFinal: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

/**
 * 创建 search_files Tool
 */
function createSearchFilesTool(): ToolDefinition {
  return {
    name: 'search_files',
    description: '按文件名模糊搜索文件。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        folder: { type: 'string', description: '在哪个文件夹内搜索，默认书架根目录' }
      },
      required: ['query']
    },
    execute: async (params) => {
      const { query, folder } = params
      // 先列出文件夹内容，再过滤
      const folderPath = folder as string || ''
      const entries = await window.electronAPI.mcp.listFiles(folderPath as string)
      const queryLower = (query as string).toLowerCase()
      const matched = entries.filter(e =>
        e.name.toLowerCase().includes(queryLower)
      )
      return {
        tool: 'search_files',
        args: params,
        result: matched,
        success: true,
        isFinal: true
      }
    }
  }
}

/**
 * 创建 list_folder_contents Tool
 */
function createListFolderContentsTool(): ToolDefinition {
  return {
    name: 'list_folder_contents',
    description: '收集文件夹下所有直接子文件（非递归）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件夹路径' }
      },
      required: ['path']
    },
    execute: async (params) => {
      const { path } = params
      try {
        const entries = await window.electronAPI.mcp.listFiles(path as string)
        const files = entries.filter(e => e.type !== 'directory')
        return {
          tool: 'list_folder_contents',
          args: params,
          result: files,
          success: true,
          isFinal: true
        }
      } catch (error) {
        return {
          tool: 'list_folder_contents',
          args: params,
          result: null,
          success: false,
          isFinal: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

/**
 * 创建 count_folder_items Tool
 */
function createCountFolderItemsTool(): ToolDefinition {
  return {
    name: 'count_folder_items',
    description: '统计文件夹内有多少本书（文件）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件夹路径' }
      },
      required: ['path']
    },
    execute: async (params) => {
      const { path } = params
      try {
        const entries = await window.electronAPI.mcp.listFiles(path as string)
        const fileCount = entries.filter(e => e.type !== 'directory').length
        return {
          tool: 'count_folder_items',
          args: params,
          result: { count: fileCount, path },
          success: true,
          isFinal: true
        }
      } catch (error) {
        return {
          tool: 'count_folder_items',
          args: params,
          result: null,
          success: false,
          isFinal: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

/**
 * 创建 get_file_metadata Tool
 */
function createGetFileMetadataTool(): ToolDefinition {
  return {
    name: 'get_file_metadata',
    description: '获取文件元信息：大小、创建时间、修改时间。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件完整路径' }
      },
      required: ['path']
    },
    execute: async (params) => {
      const { path } = params
      try {
        // 通过 listFiles 获取 metadata
        const entries = await window.electronAPI.mcp.listFiles(path as string)
        // path 可能是文件或目录
        const entry = entries.find(e => e.path === path)
        if (entry) {
          return {
            tool: 'get_file_metadata',
            args: params,
            result: {
              name: entry.name,
              size: entry.size,
              lastModified: entry.lastModified,
              type: entry.type
            },
            success: true,
            isFinal: true
          }
        }
        return {
          tool: 'get_file_metadata',
          args: params,
          result: null,
          success: false,
          isFinal: false,
          error: 'File not found'
        }
      } catch (error) {
        return {
          tool: 'get_file_metadata',
          args: params,
          result: null,
          success: false,
          isFinal: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

/**
 * 创建 create_file Tool
 */
function createCreateFileTool(): ToolDefinition {
  return {
    name: 'create_file',
    description: '创建文本文件并写入内容。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件完整路径' },
        content: { type: 'string', description: '文件内容' }
      },
      required: ['path', 'content']
    },
    execute: async (params) => {
      const { path, content } = params
      try {
        await window.electronAPI.mcp.writeFile(path as string, content as string)
        return {
          tool: 'create_file',
          args: params,
          result: { path, created: true },
          success: true,
          isFinal: true
        }
      } catch (error) {
        return {
          tool: 'create_file',
          args: params,
          result: null,
          success: false,
          isFinal: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

/**
 * 创建 move_file Tool
 */
function createMoveFileTool(): ToolDefinition {
  return {
    name: 'move_file',
    description: '移动或重命名文件。',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: '源文件路径' },
        destination: { type: 'string', description: '目标路径' }
      },
      required: ['source', 'destination']
    },
    execute: async (params) => {
      const { source, destination } = params
      try {
        await window.electronAPI.mcp.moveFile(source as string, destination as string)
        return {
          tool: 'move_file',
          args: params,
          result: { moved: true, from: source, to: destination },
          success: true,
          isFinal: true
        }
      } catch (error) {
        return {
          tool: 'move_file',
          args: params,
          result: null,
          success: false,
          isFinal: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

/**
 * 创建 create_directory Tool
 */
function createCreateDirectoryTool(): ToolDefinition {
  return {
    name: 'create_directory',
    description: '创建新目录，支持多级创建。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径' }
      },
      required: ['path']
    },
    execute: async (params) => {
      const { path } = params
      try {
        await window.electronAPI.mcp.createDirectory(path as string)
        return {
          tool: 'create_directory',
          args: params,
          result: { path, created: true },
          success: true,
          isFinal: true
        }
      } catch (error) {
        return {
          tool: 'create_directory',
          args: params,
          result: null,
          success: false,
          isFinal: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

/**
 * 创建 delete_file Tool
 */
function createDeleteFileTool(): ToolDefinition {
  return {
    name: 'delete_file',
    description: '删除文件或文件夹。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要删除的文件/文件夹路径' }
      },
      required: ['path']
    },
    execute: async (params) => {
      const { path } = params
      try {
        await window.electronAPI.mcp.deleteFile(path as string)
        return {
          tool: 'delete_file',
          args: params,
          result: { deleted: true, path },
          success: true,
          isFinal: true
        }
      } catch (error) {
        return {
          tool: 'delete_file',
          args: params,
          result: null,
          success: false,
          isFinal: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

/**
 * 注册所有内置 Tools
 */
export function registerBuiltinTools(): void {
  const registry = ToolRegistry.getInstance()

  const tools = [
    createListFilesTool(),
    createGetFileContentTool(),
    createSearchFilesTool(),
    createListFolderContentsTool(),
    createCountFolderItemsTool(),
    createGetFileMetadataTool(),
    createCreateFileTool(),
    createMoveFileTool(),
    createCreateDirectoryTool(),
    createDeleteFileTool(),
  ]

  for (const tool of tools) {
    registry.register(tool)
  }

  console.log(`[ToolRegistry] Registered ${tools.length} builtin tools`)
}
```

- [ ] **Step 3: 在 librarian-agent.ts 中初始化 ToolRegistry**

在文件开头添加：

```typescript
import { ToolRegistry, registerBuiltinTools } from './tool-registry'

// 初始化时注册所有 Tools
let toolsInitialized = false
function ensureToolsInitialized(): void {
  if (!toolsInitialized) {
    registerBuiltinTools()
    toolsInitialized = true
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/features/bookshelf/services/tool-registry.ts src/features/bookshelf/services/tool-definitions.ts src/features/bookshelf/services/librarian-agent.ts
git commit -m "feat(bookshelf): 实现 Tool 注册表和 10 个内置 Tool"
```

---

## Task 3: 实现 SkillManager（Skill 加载/保存/查重）

**Files:**
- Create: `src/features/bookshelf/services/skill-manager.ts`
- Create: `skills/catalog.json` (空目录占位)

- [ ] **Step 1: 创建 SkillManager 类**

```typescript
// src/features/bookshelf/services/skill-manager.ts

import type { Skill, SkillCatalog } from '../types/skill'
import type { SolidificationResult, SkillStep } from '@/shared/types'

const BUILTIN_SKILLS_DIR = 'skills'  // 项目内置
const USER_SKILLS_DIR = '$USERDATA/skills'  // 用户积累

/**
 * Skill 管理器 - 负责加载、解析、保存 Skill
 */
export class SkillManager {
  private static instance: SkillManager | null = null
  private skills = new Map<string, Skill>()
  private builtinSkillsDir: string
  private userSkillsDir: string

  private constructor() {
    // 初始化目录路径
    this.builtinSkillsDir = BUILTIN_SKILLS_DIR
    this.userSkillsDir = USER_SKILLS_DIR
  }

  public static getInstance(): SkillManager {
    if (!SkillManager.instance) {
      SkillManager.instance = new SkillManager()
    }
    return SkillManager.instance
  }

  /**
   * 加载所有 Skills（内置 + 用户积累）
   */
  async loadAll(): Promise<void> {
    this.skills.clear()

    // 加载内置 Skills
    await this.loadSkillsFromDir(this.builtinSkillsDir)

    // 加载用户积累 Skills
    await this.loadSkillsFromDir(this.userSkillsDir)

    console.log(`[SkillManager] Loaded ${this.skills.size} skills`)
  }

  /**
   * 从目录加载 Skills
   */
  private async loadSkillsFromDir(dirPath: string): Promise<void> {
    try {
      // 读取目录下的所有 .md 文件
      // 注意：$USERDATA 需要通过 IPC 调用主进程
      const files = dirPath === this.userSkillsDir
        ? await this.loadUserSkillFiles()
        : await this.loadBuiltinSkillFiles(dirPath)

      for (const file of files) {
        if (file.endsWith('.md')) {
          try {
            const skill = await this.parseSkillFile(file)
            this.skills.set(skill.name, skill)
          } catch (error) {
            console.warn(`[SkillManager] Failed to parse skill file: ${file}`, error)
          }
        }
      }
    } catch (error) {
      console.warn(`[SkillManager] Failed to load skills from ${dirPath}:`, error)
    }
  }

  /**
   * 通过 IPC 加载用户 Skills 文件列表
   */
  private async loadUserSkillFiles(): Promise<string[]> {
    try {
      return await window.electronAPI.getSkillFiles(this.userSkillsDir)
    } catch {
      return []
    }
  }

  /**
   * 加载内置 Skills 文件列表（开发环境直接读文件）
   */
  private async loadBuiltinSkillFiles(dirPath: string): Promise<string[]> {
    // 开发环境使用 import.meta.glob
    // 打包环境使用 fs 读取
    if (import.meta.env.DEV) {
      const modules = import.meta.glob.globSync(['./../../skills/*.md', './../../skills/**/*.md'])
      return Object.keys(modules)
    } else {
      // 生产环境通过 IPC 读取
      return await window.electronAPI.getSkillFiles(dirPath)
    }
  }

  /**
   * 解析 Skill MD 文件
   */
  async parseSkillFile(filePath: string): Promise<Skill> {
    const content = await this.readFileContent(filePath)
    return this.parseSkillMarkdown(content)
  }

  /**
   * 解析 Skill Markdown 内容
   */
  parseSkillMarkdown(content: string): Skill {
    // 简单解析：提取 ## 标题 和 ```表格内容
    const lines = content.split('\n')
    let name = ''
    let description = ''
    let inDescription = false
    let inParams = false
    let inSteps = false
    let inConstraints = false
    let in适用条件 = false

    const params: Record<string, { type: string; description: string }> = {}
    const steps: SkillStep[] = []
    const constraints: string[] = []
    const适用条件: string[] = []

    for (const line of lines) {
      if (line.startsWith('# Skill:')) {
        name = line.replace('# Skill:', '').trim()
      } else if (line.startsWith('## 描述') || line.startsWith('## 描述')) {
        inDescription = true
        inParams = false
        inSteps = false
        inConstraints = false
        in适用条件 = false
      } else if (line.startsWith('## 参数模板') || line.startsWith('## 参数模板')) {
        inDescription = false
        inParams = true
        inSteps = false
        inConstraints = false
        in适用条件 = false
      } else if (line.startsWith('## 执行步骤') || line.startsWith('## 执行步骤')) {
        inDescription = false
        inParams = false
        inSteps = true
        inConstraints = false
        in适用条件 = false
      } else if (line.startsWith('## 约束') || line.startsWith('## 约束')) {
        inDescription = false
        inParams = false
        inSteps = false
        inConstraints = true
        in适用条件 = false
      } else if (line.startsWith('## 适用条件') || line.startsWith('## 适用条件')) {
        inDescription = false
        inParams = false
        inSteps = false
        inConstraints = false
        in适用条件 = true
      } else if (line.trim() === '---') {
        // section 分隔
      } else if (inDescription && line.trim()) {
        description += line.trim() + ' '
      } else if (in适用条件 && line.trim().startsWith('-')) {
        适用条件.push(line.trim().replace(/^-\s*/, ''))
      } else if (inParams && line.includes('|') && !line.startsWith('|')) {
        // 表格行
        const parts = line.split('|').map(s => s.trim()).filter(Boolean)
        if (parts.length >= 3 && parts[0] !== '参数') {
          params[parts[0]] = { type: parts[1], description: parts[2] }
        }
      } else if (inSteps && line.trim().startsWith('-')) {
        // 步骤行
        // 格式: `tool_name({ params })` 或 `- tool_name: description`
        const match = line.match(/`(\w+)\(\{([^}]*)\}\)`/)
        if (match) {
          steps.push({
            tool: match[1],
            description: '',
            params: this.parseParamsString(match[2])
          })
        }
      } else if (inConstraints && line.trim().startsWith('-')) {
        constraints.push(line.trim().replace(/^-\s*/, ''))
      }
    }

    return {
      name,
      description: description.trim(),
      适用条件,
      paramTemplate: params,
      steps,
      constraints
    }
  }

  /**
   * 解析参数字符串
   */
  private parseParamsString(str: string): Record<string, string> {
    const result: Record<string, string> = {}
    const pairs = str.split(',').map(s => s.trim())
    for (const pair of pairs) {
      const [key, value] = pair.split(':').map(s => s.trim())
      if (key && value) {
        result[key] = value
      }
    }
    return result
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(filePath: string): Promise<string> {
    if (filePath.startsWith('$USERDATA')) {
      return await window.electronAPI.readSkillFile(filePath)
    }
    // 内置 Skills 通过 import 读取
    const response = await fetch(filePath)
    return response.text()
  }

  /**
   * 获取所有 Skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values())
  }

  /**
   * 根据名称获取 Skill
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  /**
   * 检查是否需要查重（防止重复固化）
   */
  findSimilarSkill(skillDescription: string): Skill | undefined {
    const keywords = this.extractKeywords(skillDescription)
    for (const skill of this.skills.values()) {
      const skillKeywords = this.extractKeywords(skill.description)
      // 有超过一半的关键词重叠，认为相似
      const overlap = keywords.filter(k => skillKeywords.includes(k)).length
      if (overlap >= keywords.length / 2) {
        return skill
      }
    }
    return undefined
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .split(/[\s，、,]+/)
      .filter(w => w.length > 2)
  }

  /**
   * 保存新 Skill（异步，后台执行）
   */
  async saveSkill(skill: Skill): Promise<void> {
    const content = this.serializeSkill(skill)
    const filePath = `${this.userSkillsDir}/${skill.name}.md`

    await window.electronAPI.writeSkillFile(filePath, content)
    this.skills.set(skill.name, skill)
    console.log(`[SkillManager] Saved skill: ${skill.name}`)
  }

  /**
   * 序列化 Skill 为 MD 内容
   */
  serializeSkill(skill: Skill): string {
    const paramRows = Object.entries(skill.paramTemplate)
      .map(([key, val]) => `| ${key} | ${val.type} | ${val.description} |`)
      .join('\n')

    const stepsText = skill.steps
      .map(s => `- \`${s.tool}(${Object.entries(s.params).map(([k, v]) => `${k}: ${v}`).join(', ')})\``)
      .join('\n')

    const constraintsText = skill.constraints.map(c => `- ${c}`).join('\n')
    const 适用条件Text = skill.适用条件.map(c => `- ${c}`).join('\n')

    return `# Skill: ${skill.name}

## 描述
${skill.description}

适用于：
${适用条件Text}

## 参数模板
| 参数 | 类型 | 说明 |
|------|------|------|
${paramRows}

## 执行步骤（模板形式，非具体参数）
${stepsText}

## 约束
${constraintsText}
`
  }

  /**
   * 生成 System Prompt 中 Skills 部分
   */
  getSystemPromptAddition(): string {
    if (this.skills.size === 0) return ''

    return this.skills
      .map(s => `## Skill: ${s.name}\n\n${s.description}\n\n参数：${JSON.stringify(s.paramTemplate)}\n\n适用条件：${s.适用条件.join('；')}`)
      .join('\n\n---\n\n')
  }
}
```

- [ ] **Step 2: 创建 skills/catalog.json**

```json
{
  "version": 1,
  "skills": []
}
```

- [ ] **Step 3: 添加 IPC handlers 支持 Skill 文件操作**

在 `electron/main/ipc-handlers.ts` 中添加：

```typescript
// Skills 文件操作 handlers
ipcMain.handle('skills:list', async (_, dirPath: string): Promise<string[]> => {
  try {
    const files = await fs.readdir(dirPath)
    return files.filter(f => f.endsWith('.md'))
  } catch {
    return []
  }
})

ipcMain.handle('skills:read', async (_, filePath: string): Promise<string> => {
  return await fs.readFile(filePath, 'utf-8')
})

ipcMain.handle('skills:write', async (_, filePath: string, content: string): Promise<void> => {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
})
```

在 `src/shared/types/index.ts` 中添加 IPC API 类型：

```typescript
interface ElectronAPI {
  // ... existing
  getSkillFiles(dirPath: string): Promise<string[]>
  readSkillFile(filePath: string): Promise<string>
  writeSkillFile(filePath: string, content: string): Promise<void>
}
```

- [ ] **Step 4: 提交**

```bash
git add src/features/bookshelf/services/skill-manager.ts src/features/bookshelf/types/skill.ts skills/catalog.json electron/main/ipc-handlers.ts src/shared/types/index.ts
git commit -m "feat(bookshelf): 实现 SkillManager（加载/保存/查重）"
```

---

## Task 4: 实现 Agent 层（ReAct Loop + Skill 路由）

**Files:**
- Modify: `src/features/bookshelf/services/librarian-agent.ts`

- [ ] **Step 1: 修改 recognizeIntent 为支持动态 Tools + Skills 的版本**

替换 `recognizeIntent` 函数：

```typescript
/**
 * 识别意图 + 路由（支持 Skill 命中或 ReAct Loop）
 */
export async function recognizeAndRoute(
  userInput: string,
  availablePaths: string[],
  llmConfig: LlmConfig,
  rootFolderNames: string[] = [],
): Promise<ExecutionPlan> {
  // 确保 Tools 已初始化
  ensureToolsInitialized()

  // 加载 Skills
  const skillManager = SkillManager.getInstance()
  await skillManager.loadAll()

  const systemPrompt = buildAgentSystemPromptV2(
    rootFolderNames,
    ToolRegistry.getInstance().getSchemas(),
    skillManager.getSystemPromptAddition()
  )

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
      maxTokens: 512,
    })
    const reader = stream.getReader()
    let fullContent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) fullContent += value
    }
    return parseExecutionPlan(fullContent)
  } catch (error) {
    console.error('[LibrarianAgent] Intent recognition failed:', error)
    return { type: 'tools', toolCalls: [], thought: '识别失败' }
  }
}

/**
 * 解析 LLM 返回的执行计划
 */
function parseExecutionPlan(response: string): ExecutionPlan {
  let trimmed = response.trim()
  if (trimmed.startsWith('```json')) trimmed = trimmed.slice(7)
  if (trimmed.startsWith('```')) trimmed = trimmed.slice(3)
  if (trimmed.endsWith('```')) trimmed = trimmed.slice(0, -3)
  trimmed = trimmed.trim()

  try {
    const parsed = JSON.parse(trimmed)
    // 检查是否命中 Skill
    if (parsed.skillName) {
      return {
        type: 'skill',
        skillName: parsed.skillName,
        skillParams: parsed.skillParams || {},
      }
    }
    // 否则是 tools 类型
    return {
      type: 'tools',
      thought: parsed.thought,
      toolCalls: parsed.toolCalls || [],
      maxSteps: parsed.maxSteps || 10,
    }
  } catch {
    console.warn('[LibrarianAgent] Failed to parse plan:', response)
    return { type: 'tools', toolCalls: [], thought: '解析失败' }
  }
}
```

- [ ] **Step 2: 实现 ReAct Loop**

```typescript
const MAX_STEPS = 10

/**
 * ReAct Loop - 多步执行
 */
export async function reactLoop(
  initialPlan: ExecutionPlan,
  context: {
    bookshelfPath: string
    rootFolderNames: string[]
    llmConfig: LlmConfig
  }
): Promise<{ success: boolean; history: ToolCallResult[]; message: string }> {
  ensureToolsInitialized()
  const registry = ToolRegistry.getInstance()

  const { maxSteps = MAX_STEPS } = initialPlan
  const history: ToolCallResult[] = []
  let pendingToolCalls = initialPlan.toolCalls || []
  let currentStep = 0

  while (currentStep < maxSteps) {
    currentStep++

    // 执行当前步的工具调用
    const results = await registry.executeAll(pendingToolCalls)
    history.push(...results)

    // 格式化观察结果
    const observations = results.map(r => formatObservation(r))

    // 判断是否完成（所有工具都返回 isFinal=true）
    const done = results.every(r => r.isFinal)
    if (done) break

    // 如果还有步骤，让 LLM 决定下一步
    const nextPlan = await decideNextStep(
      initialPlan.thought || '',
      history,
      observations,
      context
    )

    if (nextPlan.type === 'done') {
      break
    }

    if (nextPlan.type === 'tools' && nextPlan.toolCalls) {
      pendingToolCalls = nextPlan.toolCalls
    } else {
      break
    }
  }

  const message = formatFinalMessage(history)
  return {
    success: currentStep < maxSteps,
    history,
    message
  }
}

/**
 * 格式化工具结果为观察字符串
 */
function formatObservation(result: ToolCallResult): string {
  if (!result.success) {
    return `[${result.tool}] 失败: ${result.error}`
  }
  const content = typeof result.result === 'object'
    ? JSON.stringify(result.result)
    : String(result.result)
  return `[${result.tool}] ${content}`
}

/**
 * 让 LLM 根据观察结果决定下一步
 */
async function decideNextStep(
  originalThought: string,
  history: ToolCallResult[],
  observations: string[],
  context: {
    bookshelfPath: string
    rootFolderNames: string[]
    llmConfig: LlmConfig
  }
): Promise<ExecutionPlan> {
  const systemPrompt = buildReActPrompt(
    context.rootFolderNames,
    ToolRegistry.getInstance().getSchemas()
  )

  const historyText = history.map((h, i) =>
    `Step ${i + 1}: ${h.tool}(${JSON.stringify(h.args)}) = ${h.success ? '成功' : '失败: ' + h.error}`
  ).join('\n')

  const userMessage = `
当前任务：${originalThought}

执行历史：
${historyText}

观察结果：
${observations.map(o => `- ${o}`).join('\n')}

根据观察结果，决定下一步操作（如果任务完成，返回 type: "done"）：
`.trim()

  const messages: Message[] = [
    { id: crypto.randomUUID(), role: 'system', content: systemPrompt, timestamp: 0 },
    { id: crypto.randomUUID(), role: 'user', content: userMessage, timestamp: Date.now() },
  ]

  try {
    const stream = createLlmStream(messages, {
      ...context.llmConfig,
      stream: true,
      temperature: 0.1,
      maxTokens: 512,
    })
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
function formatFinalMessage(history: ToolCallResult[]): string {
  const successful = history.filter(r => r.success)
  const failed = history.filter(r => !r.success)

  if (failed.length > 0) {
    return `完成（有 ${failed.length} 步失败）：${failed.map(f => `${f.tool}: ${f.error}`).join('；')}`
  }
  return `完成：共执行 ${history.length} 步`
}
```

- [ ] **Step 3: 实现固化判断**

```typescript
/**
 * 判断任务是否值得固化
 */
export async function judgeSolidification(
  task: string,
  steps: ToolCallResult[],
  existingSkills: Skill[]
): Promise<SolidificationResult> {
  ensureToolsInitialized()

  const stepsJson = steps.map(s => ({
    tool: s.tool,
    args: s.args,
    success: s.success
  }))

  const prompt = `
分析以下任务的执行过程，判断是否值得固化成可复用 Skill。

任务：${task}
执行步骤：${JSON.stringify(stepsJson, null, 2)}
当前已有 Skills：${existingSkills.map(s => s.name).join(', ') || '无'}

判断标准（四重门禁，全部满足才固化）：
1. 步骤数 > 3（太简单的任务不需要固化）
2. 可参数化程度高（能抽象成"把 X 从 A 移到 B"这样的泛型模式）
3. 预期重复性高（这类任务下次还可能遇到）
4. 已有 Skills 中无功能重复的 Skill（查重，避免固化重复的 SOP）

输出格式（严格 JSON）：
{
  "shouldSolidify": true/false,
  "reason": "判断理由",
  "skillName": "建议的 Skill 名称（如 move-books-between-folders）",
  "generalizedDescription": "泛型描述（如：将文件夹 X 中的所有书籍移动到文件夹 Y）",
  "paramTemplate": { "sourceFolder": { "type": "string", "description": "源文件夹路径" }, "destFolder": { "type": "string", "description": "目标文件夹路径" } },
  "steps": [ { "tool": "工具名", "description": "步骤描述", "params": { "参数": "值来源" } } ]
}
`.trim()

  const messages: Message[] = [
    { id: crypto.randomUUID(), role: 'user', content: prompt, timestamp: Date.now() }
  ]

  try {
    const stream = createLlmStream(messages, {
      temperature: 0.3,
      maxTokens: 1024,
    })
    const reader = stream.getReader()
    let fullContent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) fullContent += value
    }
    return JSON.parse(fullContent)
  } catch (error) {
    console.error('[LibrarianAgent] judgeSolidification failed:', error)
    return { shouldSolidify: false, reason: 'LLM 调用失败' }
  }
}

/**
 * 执行 Skill（Skill 命中后直接执行）
 */
async function executeSkill(
  skill: Skill,
  params: Record<string, unknown>
): Promise<ToolCallResult[]> {
  const registry = ToolRegistry.getInstance()
  const results: ToolCallResult[] = []

  for (const step of skill.steps) {
    // 替换参数模板中的占位符
    const actualParams: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(step.params)) {
      actualParams[key] = params[value as string] ?? value
    }

    const result = await registry.execute(step.tool, actualParams)
    results.push(result)

    if (!result.success) {
      break
    }
  }

  return results
}
```

- [ ] **Step 4: 修改 executeLibrarianCommand 整合所有组件**

```typescript
/**
 * 执行 Librarian Agent 命令（整合 Skill 路由 + ReAct Loop + 固化）
 */
export async function executeLibrarianCommandV2(
  userInput: string,
  bookshelfPath: string,
  files: BookFile[],
  llmConfig: LlmConfig,
  rootFolders: BookFile[] = [],
): Promise<AgentExecuteResult> {
  const startTime = Date.now()
  ensureToolsInitialized()

  // 加载 Skills
  const skillManager = SkillManager.getInstance()
  await skillManager.loadAll()

  // Step 1: 意图识别 + 路由
  const availablePaths = files.map(f => f.path)
  const rootFolderNames = rootFolders.map(f => f.name)

  const plan = await recognizeAndRoute(
    userInput,
    availablePaths,
    llmConfig,
    rootFolderNames
  )

  let history: ToolCallResult[] = []
  let success = false

  // Step 2: 根据计划类型执行
  if (plan.type === 'skill' && plan.skillName) {
    // Skill 命中，直接执行
    const skill = skillManager.get(plan.skillName)
    if (skill) {
      history = await executeSkill(skill, plan.skillParams || {})
      success = history.every(r => r.success)
    }
  } else if (plan.type === 'tools') {
    // 进入 ReAct Loop
    const result = await reactLoop(plan, {
      bookshelfPath,
      rootFolderNames,
      llmConfig
    })
    history = result.history
    success = result.success

    // Step 3: 固化判断（异步，不阻塞）
    if (success && history.length > 3) {
      const existingSkills = skillManager.getAll()
      judgeAndSaveSkill(userInput, history, existingSkills, skillManager)
    }
  }

  const message = formatFinalMessage(history)
  const baseOp: Partial<AgentOperation> = {
    id: crypto.randomUUID(),
    timestamp: startTime,
    input: userInput,
    result: success ? 'success' : 'error',
    message,
    duration: Date.now() - startTime,
  }

  return { success, message, operation: baseOp }
}

/**
 * 异步固化判断并保存
 */
async function judgeAndSaveSkill(
  task: string,
  steps: ToolCallResult[],
  existingSkills: Skill[],
  skillManager: SkillManager
): Promise<void> {
  try {
    const result = await judgeSolidification(task, steps, existingSkills)
    if (result.shouldSolidify) {
      // 查重
      const similar = skillManager.findSimilarSkill(result.generalizedDescription || '')
      if (!similar) {
        await skillManager.saveSkill({
          name: result.skillName!,
          description: result.generalizedDescription!,
          适用条件: [],  // LLM 生成的适用条件
          paramTemplate: result.paramTemplate || {},
          steps: result.steps || [],
          constraints: []
        })
        console.log(`[LibrarianAgent] Skill solidified: ${result.skillName}`)
      }
    }
  } catch (error) {
    console.warn('[LibrarianAgent] Failed to solidify skill:', error)
  }
}
```

- [ ] **Step 5: 提交**

```bash
git add src/features/bookshelf/services/librarian-agent.ts
git commit -m "feat(bookshelf): 实现 ReAct Loop + Skill 路由 + 固化判断"
```

---

## Task 5: 实现新的 System Prompt 构建

**Files:**
- Modify: `src/features/bookshelf/utils/librarian-prompt.ts`

- [ ] **Step 1: 创建支持动态 Tools 的 System Prompt 构建函数**

```typescript
/**
 * 构建 Agent System Prompt（支持动态 Tools + Skills）
 */
export function buildAgentSystemPromptV2(
  rootFolderNames: string[],
  toolSchemas: object[],
  skillsPrompt: string
): string {
  const folderList = rootFolderNames.length > 0
    ? rootFolderNames.map(f => `  - ${f}`).join('\n')
    : '  (暂无文件夹)'

  const toolsSection = toolSchemas.length > 0
    ? `\n## 可用 Tools\n\n你可以通过调用以下工具来完成用户请求：\n\n${toolSchemas.map((t: any) =>
      `### ${t.function.name}\n描述：${t.function.description}\n参数：${JSON.stringify(t.function.parameters)}`
    ).join('\n\n')}`
    : ''

  return `你是一个智能书架管理助手（Librarian Agent），负责管理用户的书籍和文件夹。

## 核心能力
1. 你可以调用多种工具（list_files, move_file, create_directory 等）来完成复杂任务
2. 对于多步骤任务，你会一步步执行并观察结果
3. 你可以将常用的多步骤任务固化为可复用的 Skill

## 重要约束
1. 用户提供"路径"即可，不要猜测文件名
2. 根目录只放子目录，书籍文件放在子目录中
3. 仅允许在根目录创建一级子文件夹
4. delete_file 在本系统语义中表示"删除文件夹"
5. move_file 仅用于移动书籍文件到目标文件夹
6. 如果任务需要多步完成，你应该逐步执行并根据观察结果调整

## 当前一级文件夹（move_file target 只能选自此列表）
${folderList}
${toolsSection}
${skillsPrompt ? `\n## 可用 Skills\n\n以下是你已掌握的技能，可以直接调用：\n\n${skillsPrompt}` : ''}
## 输出格式

当你需要调用工具时，输出 JSON：
{
  "thought": "你的思考过程",
  "toolCalls": [
    { "tool": "工具名", "args": { "参数名": "参数值" } }
  ]
}

当任务完成时，输出：
{ "type": "done" }

当你想使用已有 Skill 时，输出：
{ "skillName": "skill-name", "skillParams": { "参数": "值" } }
`.trim()
}

/**
 * 构建 ReAct Loop 决策用 Prompt
 */
export function buildReActPrompt(
  rootFolderNames: string[],
  toolSchemas: object[]
): string {
  const folderList = rootFolderNames.length > 0
    ? rootFolderNames.map(f => `  - ${f}`).join('\n')
    : '  (暂无文件夹)'

  return `你是一个书架管理 Agent，正在执行多步骤任务。

## 当前一级文件夹
${folderList}

## 可用工具
${toolSchemas.map((t: any) =>
    `- ${t.function.name}: ${t.function.description}`
  ).join('\n')}

## 决策规则
1. 如果任务已全部完成，返回 { "type": "done" }
2. 如果需要继续执行，返回下一步的工具调用：{ "type": "tools", "toolCalls": [...] }
3. 每一步最多调用 3 个工具（可并行）

## 输出格式（严格 JSON）
`.trim()
}
```

- [ ] **Step 2: 提交**

```bash
git add src/features/bookshelf/utils/librarian-prompt.ts
git commit -m "feat(bookshelf): 实现动态 Tools + Skills 的 System Prompt"
```

---

## Task 6: 添加 UI 入口（useLibrarian Hook 更新）

**Files:**
- Modify: `src/features/bookshelf/hooks/useLibrarian.ts`

- [ ] **Step 1: 更新 useLibrarian 使用新版 executeLibrarianCommandV2**

```typescript
// 在 useLibrarian.ts 中，将 executeLibrarianCommand 调用替换为 executeLibrarianCommandV2
// 注意：保持向后兼容，如果 V2 失败可以 fallback 到 V1
```

- [ ] **Step 2: 提交**

```bash
git add src/features/bookshelf/hooks/useLibrarian.ts
git commit -m "feat(bookshelf): 更新 useLibrarian 使用 V2 执行器"
```

---

## Task 7: 集成测试

**Files:**
- Create: `src/features/bookshelf/__tests__/tool-registry.test.ts`
- Create: `src/features/bookshelf/__tests__/skill-manager.test.ts`

- [ ] **Step 1: ToolRegistry 测试**

```typescript
import { describe, it, expect } from 'vitest'
import { ToolRegistry } from '../services/tool-registry'

describe('ToolRegistry', () => {
  it('should register and retrieve tools', () => {
    const registry = ToolRegistry.getInstance()
    const tool = {
      name: 'test_tool',
      description: 'test',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => ({ tool: 'test_tool', args: {}, result: 'ok', success: true, isFinal: true })
    }
    registry.register(tool)
    expect(registry.get('test_tool')).toBeDefined()
    expect(registry.getAll()).toContain(tool)
  })

  it('should return schemas for LLM', () => {
    const registry = ToolRegistry.getInstance()
    const schemas = registry.getSchemas()
    expect(Array.isArray(schemas)).toBe(true)
  })
})
```

- [ ] **Step 2: SkillManager 测试**

```typescript
import { describe, it, expect } from 'vitest'
import { SkillManager } from '../services/skill-manager'

describe('SkillManager', () => {
  it('should parse skill markdown', () => {
    const manager = SkillManager.getInstance()
    const markdown = `
# Skill: test-skill

## 描述
这是一个测试 Skill

## 适用条件
- 用户说"测试"

## 参数模板
| 参数 | 类型 | 说明 |
|------|------|------|
| source | string | 源路径 |

## 执行步骤（模板形式）
- \`list_files({ "path": "source" })\`

## 约束
- 只读
`
    const skill = manager.parseSkillMarkdown(markdown)
    expect(skill.name).toBe('test-skill')
    expect(skill.paramTemplate.source).toBeDefined()
  })
})
```

- [ ] **Step 3: 提交**

```bash
git add src/features/bookshelf/__tests__/
git commit -m "test(bookshelf): 添加 ToolRegistry 和 SkillManager 测试"
```

---

## 验证计划

1. **单元测试**: `npm test src/features/bookshelf/__tests__/`
2. **手动测试**:
   - 测试"列出所有书籍"（list_files）
   - 测试"把 a 文件夹的书移到 b 文件夹"（多步）
   - 测试"找出所有在'科幻'文件夹里但是作者是刘慈欣的书"（搜索 + 过滤）
   - 验证 Skill 固化后下次能用

---

## 风险与备选

| 风险 | 缓解措施 |
|------|----------|
| LLM 幻觉乱选工具 | Tool schemas 精确描述 + maxSteps 限制 |
| Skill 查重不准确 | 只用关键词重叠率，保守策略 |
| 多步执行失败 | 每步独立，失败即停止 |

---

## 顺序依赖

```
Task 1 (类型定义)
    ↓
Task 2 (ToolRegistry) ← 依赖 Task 1
    ↓
Task 3 (SkillManager) ← 依赖 Task 1
    ↓
Task 5 (System Prompt) ← 依赖 Task 2, 3
    ↓
Task 4 (Agent Loop) ← 依赖 Task 1, 2, 3, 5
    ↓
Task 6 (UI Hook)
    ↓
Task 7 (测试)
```
