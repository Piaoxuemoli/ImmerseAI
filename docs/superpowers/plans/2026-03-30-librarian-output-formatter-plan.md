# Librarian Agent 输出格式化与参数健壮性实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决 LLM 参数名不可靠问题 + 将原始工具输出格式化为用户可读格式

**Architecture:** 
- 参数健壮性：四层方案（Schema标准化 → Prompt强化 → 模糊匹配 → 执行时验证）
- 输出格式化：为每个工具设计专用格式化函数，统一入口

**Tech Stack:** TypeScript, React Hooks

---

## 文件结构

```
src/features/bookshelf/
├── services/
│   ├── tool-registry.ts      # 修改：添加参数标准化层
│   ├── tool-definitions.ts    # 修改：添加输出格式化器 + 参数别名
│   └── librarian-agent.ts    # 修改：集成格式化输出
└── utils/
    └── librarian-prompt.ts   # 修改：强化 prompt 中的参数名指导
```

---

## 第一部分：参数健壮性（四层方案）

### Task 1: 添加参数别名映射表

**Files:**
- Modify: `src/features/bookshelf/services/tool-definitions.ts:1-20`

- [ ] **Step 1: 在 tool-definitions.ts 顶部添加别名映射常量**

```typescript
/**
 * 参数名别名映射表
 * 解决 LLM 生成错误参数名的问题
 * 格式: { toolName: { alias: canonicalName } }
 */
const PARAM_ALIASES: Record<string, Record<string, string>> = {
  list_folder_contents: {
    folder_path: 'path',
    folder: 'path',
    dir: 'path',
    directory: 'path',
  },
  get_file_content: {
    file_path: 'path',
    filepath: 'path',
    file: 'path',
  },
  search_files: {
    search_path: 'path',
    dir: 'path',
    directory: 'path',
  },
  get_file_metadata: {
    file_path: 'path',
    filepath: 'path',
    file: 'path',
  },
  create_file: {
    file_path: 'path',
    filepath: 'path',
    file: 'path',
    dest: 'path',
    destination: 'path',
  },
  move_file: {
    src: 'source',
    source_path: 'source',
    file: 'source',
    dest: 'destination',
    destination_path: 'destination',
    target: 'destination',
  },
  delete_file: {
    file_path: 'path',
    filepath: 'path',
    file: 'path',
    folder_path: 'path',
  },
}
```

- [ ] **Step 2: 添加参数标准化函数**

```typescript
/**
 * 标准化参数名：将别名映射为规范名称
 */
export function normalizeParams(
  toolName: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  const aliases = PARAM_ALIASES[toolName]
  if (!aliases) return params

  const result: Record<string, unknown> = { ...params }
  
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (result[alias] !== undefined && result[canonical] === undefined) {
      result[canonical] = result[alias]
      delete result[alias]
    }
  }
  
  return result
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/bookshelf/services/tool-definitions.ts
git commit -m "feat(bookshelf): add parameter alias mapping for tool robustness"
```

---

### Task 2: 集成参数标准化到工具执行

**Files:**
- Modify: `src/features/bookshelf/services/tool-registry.ts`

- [ ] **Step 1: 在 tool-registry.ts 中导入 normalizeParams**

在文件顶部添加：
```typescript
import { normalizeParams } from './tool-definitions'
```

- [ ] **Step 2: 修改 execute 方法，在执行前标准化参数**

找到 `execute` 方法（约 line 66），在调用 `tool.execute` 前添加：

```typescript
async execute(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  const tool = this.tools.get(toolName)
  if (!tool) {
    return {
      tool: toolName,
      args,
      result: null,
      success: false,
      isFinal: false,
      error: `Tool not found: ${toolName}`,
    }
  }

  // 标准化参数（处理别名问题）
  const normalizedArgs = normalizeParams(toolName, args)

  try {
    const result = await tool.execute(normalizedArgs)
    return result
  } catch (error) {
    return {
      tool: toolName,
      args: normalizedArgs,
      result: null,
      success: false,
      isFinal: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/bookshelf/services/tool-registry.ts
git commit -m "feat(bookshelf): integrate parameter normalization in tool execution"
```

---

### Task 3: 强化 System Prompt 中的参数指导

**Files:**
- Modify: `src/features/bookshelf/utils/librarian-prompt.ts`

- [ ] **Step 1: 在 buildReActPrompt 函数中添加参数名约束**

找到 `buildReActPrompt` 函数，在 system prompt 末尾添加：

```typescript
## 重要：参数名约束

调用 tool 时，**必须**使用以下参数名，禁止使用别名：

- list_files: \`path\` (目录路径，不使用 folder_path/dir)
- list_folder_contents: \`path\` (文件夹路径，不使用 folder_path/dir)
- search_files: \`path\`, \`keyword\`
- get_file_content: \`path\` (文件路径)
- get_file_metadata: \`path\` (文件路径)
- create_file: \`path\`, \`content\`
- move_file: \`source\`, \`destination\`
- create_directory: \`path\`
- delete_file: \`path\`
- count_folder_items: \`path\`

**错误示例：**
\`\`\`json
{"name": "list_folder_contents", "params": {"folder_path": "xxx"}}  // ❌ 错误
\`\`\`

**正确示例：**
\`\`\`json
{"name": "list_folder_contents", "params": {"path": "xxx"}}  // ✅ 正确
\`\`\`
```

- [ ] **Step 2: 在 buildAgentSystemPromptV2 中也添加同样的约束**

找到 `buildAgentSystemPromptV2` 函数，添加相同的参数名约束段落。

- [ ] **Step 3: Commit**

```bash
git add src/features/bookshelf/utils/librarian-prompt.ts
git commit -m "docs(bookshelf): add parameter name constraints to system prompts"
```

---

## 第二部分：输出格式化

### Task 4: 创建输出格式化器

**Files:**
- Modify: `src/features/bookshelf/services/tool-definitions.ts`

- [ ] **Step 1: 在 tool-definitions.ts 末尾添加格式化函数**

```typescript
// ============================================
// 输出格式化器
// ============================================

import type { ToolCallResult, BookFile } from '@/shared/types'

/**
 * 格式化文件列表为树状结构
 */
function formatFileList(result: ToolCallResult): string {
  const output = result.result
  if (!result.success) return `❌ ${result.error}`

  if (!output || !Array.isArray(output)) return '（无内容）'

  const entries = output as BookFile[]
  if (entries.length === 0) return '（目录为空）'

  const lines: string[] = []
  for (const entry of entries) {
    if (entry.type === 'directory') {
      lines.push(`📁 ${entry.name}/`)
    } else {
      const icon = getFileIcon(entry.name)
      lines.push(`${icon} ${entry.name}`)
    }
  }
  return lines.join('\n')
}

/**
 * 根据文件扩展名返回图标
 */
function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md': return '📝'
    case 'txt': return '📄'
    case 'pdf': return '📕'
    case 'epub': return '📖'
    default: return '📄'
  }
}

/**
 * 格式化文件内容
 */
function formatFileContent(result: ToolCallResult): string {
  if (!result.success) return `❌ ${result.error}`

  const output = result.result
  if (output === null || output === undefined) return '（无内容）'

  const content = typeof output === 'string' ? output : String(output)
  const MAX_LENGTH = 2000

  let display = content.trim()
  if (display.length > MAX_LENGTH) {
    display = display.slice(0, MAX_LENGTH) + '\n\n... (内容已截断)'
  }

  return `📄 文件内容：\n${'─'.repeat(40)}\n${display}`
}

/**
 * 格式化搜索结果（AI 友好格式）
 */
function formatSearchResult(result: ToolCallResult): string {
  if (!result.success) return `❌ ${result.error}`

  const output = result.result
  if (!output || !Array.isArray(output)) return '（无搜索结果）'

  const matches = output as Array<{ name: string; path: string }>
  if (matches.length === 0) return '🔍 未找到匹配结果'

  const lines = [`🔍 找到 ${matches.length} 个匹配：`]
  for (const match of matches.slice(0, 10)) {
    const icon = getFileIcon(match.name)
    lines.push(`\n${icon} ${match.name}\n   路径: ${match.path}`)
  }
  if (matches.length > 10) {
    lines.push(`\n... 还有 ${matches.length - 10} 个结果`)
  }
  return lines.join('')
}

/**
 * 格式化操作结果（移动/创建/删除等）
 */
function formatOperationResult(result: ToolCallResult): string {
  if (!result.success) return `❌ ${result.error}`

  const args = result.args
  const tool = result.tool

  switch (tool) {
    case 'move_file':
      return `✅ 已移动：${args.source} → ${args.destination}`
    case 'create_file':
      return `✅ 已创建文件：${args.path}`
    case 'create_directory':
      return `✅ 已创建文件夹：${args.path}`
    case 'delete_file':
      return `✅ 已删除：${args.path}`
    case 'writeFile':
      return `✅ 已写入：${args.path}`
    default:
      return `✅ 操作完成`
  }
}

/**
 * 格式化文件夹统计
 */
function formatCountResult(result: ToolCallResult): string {
  if (!result.success) return `❌ ${result.error}`

  const output = result.result as { total: number; files: number; folders: number } | null
  if (!output) return '（无数据）'

  const { total, files, folders } = output
  return `📊 共 ${total} 项（📄 ${files} 文件, 📁 ${folders} 文件夹）`
}

/**
 * 格式化元数据
 */
function formatMetadata(result: ToolCallResult): string {
  if (!result.success) return `❌ ${result.error}`

  const output = result.result
  if (!output || typeof output !== 'object') return '（无数据）'

  const meta = output as Record<string, unknown>
  const lines = ['📋 文件信息：', '─'.repeat(30)]
  
  if (meta.name) lines.push(`名称: ${meta.name}`)
  if (meta.path) lines.push(`路径: ${meta.path}`)
  if (meta.type) lines.push(`类型: ${meta.type}`)
  if (meta.size !== undefined) lines.push(`大小: ${formatBytes(meta.size as number)}`)
  if (meta.lastModified) lines.push(`修改: ${new Date(meta.lastModified as number).toLocaleString()}`)

  return lines.join('\n')
}

/**
 * 格式化字节大小
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 统一输出格式化入口
 */
export function formatToolOutput(result: ToolCallResult): string {
  switch (result.tool) {
    case 'list_files':
    case 'list_folder_contents':
      return formatFileList(result)
    case 'get_file_content':
      return formatFileContent(result)
    case 'search_files':
      return formatSearchResult(result)
    case 'move_file':
    case 'create_file':
    case 'create_directory':
    case 'delete_file':
    case 'writeFile':
      return formatOperationResult(result)
    case 'count_folder_items':
      return formatCountResult(result)
    case 'get_file_metadata':
      return formatMetadata(result)
    default:
      // 未知工具，回退到原始格式
      return result.success
        ? (typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2))
        : `❌ ${result.error}`
  }
}
```

- [ ] **Step 2: 添加缺失的类型导入**

在文件顶部确认导入：
```typescript
import type { ToolCallResult, BookFile } from '@/shared/types'
```

如果 `BookFile` 类型不在 `@/shared/types`，需要在 `src/shared/types/index.ts` 中确认其定义。

- [ ] **Step 3: Commit**

```bash
git add src/features/bookshelf/services/tool-definitions.ts
git commit -m "feat(bookshelf): add output formatters for all tool types"
```

---

### Task 5: 集成格式化输出到 Librarian Agent

**Files:**
- Modify: `src/features/bookshelf/services/librarian-agent.ts`

- [ ] **Step 1: 在 librarian-agent.ts 中导入 formatToolOutput**

找到导入语句区域，添加：
```typescript
import { formatToolOutput } from './tool-definitions'
```

- [ ] **Step 2: 修改 formatFinalMessage 函数，使用格式化器**

找到 `formatFinalMessage` 函数（约 line 265），替换为：

```typescript
/**
 * 格式化最终消息（用户可读格式）
 */
function formatFinalMessage(results: ToolCallResult[]): string {
  if (results.length === 0) return '任务完成。'

  const lines: string[] = []
  for (const result of results) {
    const formatted = formatToolOutput(result)
    lines.push(formatted)
  }
  
  return lines.join('\n\n')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/bookshelf/services/librarian-agent.ts
git commit -m "feat(bookshelf): integrate formatted output in librarian agent"
```

---

## 验证与测试

### Task 6: 手动测试

**Files:**
- 无文件变更

- [ ] **Step 1: 测试 list_files 格式化**

输入：`列出当前目录`
预期输出：
```
📁 无分类/
```

- [ ] **Step 2: 测试 search_files 格式化**

输入：`搜索 牡蛎`
预期输出：
```
🔍 找到 X 个匹配：
📄 文件名.md
   路径: ...
```

- [ ] **Step 3: 测试参数别名容错**

输入：`列出 folder_path=.`
（故意使用错误参数名）
预期：能正确执行为 `path=.` 并格式化输出

---

## 自检清单

- [ ] 所有任务完成
- [ ] 无 placeholder/TODO
- [ ] 类型一致性检查通过
- [ ] git commit 记录完整

---

**Plan saved to:** `docs/superpowers/plans/2026-03-30-librarian-output-formatter-plan.md`
