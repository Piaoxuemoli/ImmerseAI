# 书架 Agent 方案 E：真正具备 Agent 能力

> **状态：设计稿，待审批**
>
> 方案 D（单步意图识别）已实现，支持 5 种预设意图，无法处理多步骤任务。
> 方案 E 在此基础上引入 Tools 扩展 + ReAct Loop + Skills 积累，实现真正的 Agent 调度能力。

---

## 一、定位与目标

### 方案 D 的局限

- 单步意图识别，temperature=0.1，JSON 输出
- 预设 5 种意图（list_files / move_file / create_directory / delete_file / unknown）
- 无法处理多步骤任务

**典型失效场景：**
- "把 a 文件夹里的所有书移到 b 文件夹" → 需要多步：列出 → 循环移动
- "找出所有在'科幻'文件夹里但是作者是刘慈欣的书，移到'科幻-刘慈欣'文件夹" → 需要搜索 → 过滤 → 创建目录 → 循环移动

### 方案 E 的目标

1. **Tools 扩展**：覆盖几乎所有原子操作，Agent 能自由组合
2. **多步执行**：ReAct Loop，支持条件分支和循环
3. **Skill 积累**：多步任务自动沉淀为可复用 Skill
4. **零用户感知**：Skill 固化在后台异步完成，对用户完全不透明

---

## 二、三层架构

```
用户输入（自然语言）
    │
    ▼
┌────────────────────────────────────────────────────────┐
│                    Agent（调度层）                          │
│                                                         │
│  ① 意图识别 + 路由                                        │
│     ├─ Skill 命中 → 执行对应 SOP                          │
│     └─ 未命中 → 进入 ReAct Loop                           │
│                                                         │
│  ② ReAct Loop（多步执行）                                  │
│     Think → Tool Call → Observe → ... → Done            │
│                                                         │
│  ③ 固化判断（任务完成后）                                   │
│     步骤数 > 3 且可参数化 → Agent 生成 Skill MD           │
│                                                         │
└──────────────────────┬───────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    ▼                  ▼                  ▼
 Tools(原子)      Skills(SOP)       Skills存储
                   执行                异步写入 .md
```

---

## 三、Tools 层（原子操作）

### 设计原则

Tools 是 Agent 可自由组合的最小单元。每个 Tool 有：
- **名称**（唯一标识）
- **描述**（Agent 判断是否调用的依据）
- **参数 schema**（TypeScript 类型 → JSON Schema）
- **执行函数**

### Tools 清单

| Tool | 名称 | 说明 | 内置/新增 |
|------|------|------|----------|
| list_files | 列出目录 | 递归/非递归、过滤 | 内置（方案 D 已实现） |
| get_file_content | 读取文件内容 | 返回文本前 N 字符 | 新增 |
| create_directory | 创建目录 | 支持多级创建 | 内置（方案 D 已实现） |
| move_file | 移动/重命名 | 单文件 | 内置（方案 D 已实现） |
| delete_file | 删除文件 | 一次一个 | 内置（方案 D 已实现） |
| search_files | 搜索文件 | 按名称模糊搜索 | 新增 |
| list_folder_contents | 按文件夹列出 | 收集文件夹下所有文件（非递归） | 新增 |
| count_folder_items | 计数 | 文件夹内有多少本书 | 新增 |
| get_file_metadata | 文件元信息 | 大小、创建时间、修改时间 | 新增 |
| create_file | 创建文件 | 写入文本内容 | 新增 |

### Tool 定义格式（TypeScript）

```typescript
interface ToolDefinition {
  name: string           // 唯一标识，如 'move_file'
  description: string    // 描述，Agent 用这个判断是否调用
  parameters: {
    // JSON Schema 格式
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  execute: (params: Record<string, unknown>) => Promise<ToolResult>
}
```

### Tool 注册表

```typescript
// agent/tools/tool-registry.ts
class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  // 导出给 LLM 的 tool schema 列表
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

---

## 四、Agent 层（调度核心）

### 4.1 意图识别 + 路由

**输入**：用户自然语言
**输出**：执行计划（命中 Skill 或进入 ReAct Loop）

```typescript
async function recognize(
  userInput: string,
  skills: Skill[],        // 当前可用 Skills 列表
  toolRegistry: ToolRegistry
): Promise<ExecutionPlan> {

  const systemPrompt = buildAgentSystemPrompt(skills, toolRegistry.getSchemas())

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userInput },
  ]

  // 低 temperature 意图识别
  const response = await llm.chat(messages, {
    temperature: 0.1,
    maxTokens: 512,
    // ...
  })

  // 解析 LLM 返回的计划
  return parsePlan(response)
}
```

**ExecutionPlan 格式：**

```typescript
type PlanType = 'skill' | 'tools'

interface ExecutionPlan {
  type: PlanType
  // Skill 命中时
  skillName?: string
  skillParams?: Record<string, unknown>
  // ReAct Loop 时
  thought?: string         // Agent 的推理过程
  toolCalls?: ToolCall[]   // 第一步要调用的工具
  maxSteps?: number        // 最大步数限制（防止无限循环）
}

interface ToolCall {
  tool: string      // tool name
  args: Record<string, unknown>
}
```

### 4.2 ReAct Loop（多步执行）

**输入**：ExecutionPlan（tools 类型）
**输出**：执行结果

```typescript
const MAX_STEPS = 10

async function reactLoop(
  plan: ExecutionPlan,
  toolRegistry: ToolRegistry,
  context: ExecutionContext
): Promise<LoopResult> {

  const { toolCalls, maxSteps = MAX_STEPS } = plan
  const history: ToolCallResult[] = []
  let currentStep = 0

  // 从第一步开始
  let pendingToolCalls = toolCalls ?? []

  while (currentStep < maxSteps) {
    currentStep++

    // 执行当前步的所有工具调用（可并行）
    const results = await executeAll(pendingToolCalls, toolRegistry)

    // 收集观察结果
    const observations = results.map(r => formatObservation(r))
    history.push(...results.map((r, i) => ({ call: pendingToolCalls[i], result: r })))

    // 判断是否完成
    const done = results.every(r => r.isFinal)
    if (done) break

    // 让 LLM 根据观察结果决定下一步
    const nextStep = await llm.chat([
      ...buildPrompt(plan, history),
      { role: 'assistant', content: formatObservations(observations) },
    ])

    const parsed = parsePlan(nextStep)

    if (parsed.type === 'done') {
      break  // Agent 认为任务完成
    }

    if (parsed.type === 'tools' && parsed.toolCalls) {
      pendingToolCalls = parsed.toolCalls
    } else {
      break  // 无法解析下一步，退出
    }
  }

  return { history, success: currentStep < maxSteps }
}
```

### 4.3 固化判断（任务完成后）

```typescript
interface SolidificationResult {
  shouldSolidify: boolean
  reason: string           // 判断理由
  skillName?: string        // 建议的 Skill 名称
  generalizedDescription?: string  // 泛型描述
  paramTemplate?: ParameterTemplate // 参数模板
  steps?: ToolCall[]       // 如果需要记录执行步骤
}

async function judgeSolidification(
  task: string,           // 原始用户输入
  steps: ToolCallResult[], // 执行步骤
  existingSkills: Skill[],  // 当前已有的 Skills 列表（用于查重）
  toolRegistry: ToolRegistry
): Promise<SolidificationResult> {

  const prompt = `
  分析以下任务的执行过程，判断是否值得固化成可复用 Skill。

  任务：${task}
  执行步骤：${JSON.stringify(steps)}
  当前已有 Skills：${existingSkills.map(s => s.name).join(', ') || '无'}

  判断标准（四重门禁，全部满足才固化）：
  1. 步骤数 > 3（太简单的任务不需要固化）
  2. 可参数化程度高（能抽象成"把 X 从 A 移到 B"这样的泛型模式）
  3. 预期重复性高（这类任务下次还可能遇到）
  4. 已有 Skills 中无功能重复的 Skill（查重，避免固化重复的 SOP）

  输出格式：
  {
    "shouldSolidify": true/false,
    "reason": "判断理由",
    "skillName": "建议的 Skill 名称（如 move-books-between-folders）",
    "generalizedDescription": "泛型描述（如：将文件夹 X 中的所有书籍移动到文件夹 Y）",
    "paramTemplate": { "sourceFolder": "string", "destFolder": "string" },
    "steps": [ /* 抽象后的工具调用序列，参数用占位符 */ ]
  }
  `.trim()

  const response = await llm.chat([{ role: 'user', content: prompt }], {
    temperature: 0.3,  // 略高，有创造性
    maxTokens: 1024,
  })

  return JSON.parse(response)
}
```

---

## 五、Skills 层（SOP 积累）

### 5.1 Skill MD 文件格式

存储位置：`ImmerseAI/skills/<skill-name>.md`

**命名规范**：kebab-case，无版本号
- 正确：`move-books-between-folders`
- 错误：`MoveBooksBetweenFolders`（驼峰）、`skill-v1`（版本号）

**目录结构**：
```
skills/                              # 内置 Skills（进 git）
├── catalog.json                     # 索引文件
├── move-books-between-folders.md
└── organize-books-by-author.md

$USERDATA/skills/                    # 用户积累（不进 git）
├── catalog.json                     # 索引文件
└── ...                             # 用户固化下来的 Skills
```

```markdown
# Skill: move-books-between-folders

## 描述
将文件夹 X 中的所有书籍移动到文件夹 Y。

适用于：
- 用户说"把 a 文件夹的书移到 b 文件夹"
- 用户说"把所有科幻书汇总到刘慈欣文件夹"
- 类似模式的变体表述

## 参数模板
| 参数 | 类型 | 说明 |
|------|------|------|
| sourceFolder | string | 源文件夹路径 |
| destFolder | string | 目标文件夹路径 |

## 执行步骤（模板形式，非具体参数）
1. `get_file_list_by_folder({ sourceFolder })` → 获取源文件夹所有文件
2. 过滤出书籍文件（.md, .txt）
3. 对每个文件：`move_file({ path: { file }, dest: { destFolder } })`

## 约束
- 只操作直接子文件，不递归子文件夹
- 跳过非书籍文件（.DS_Store, .gitignore 等）
- 目标文件夹不存在时自动创建

## 适用条件（Agent 判断用）
- 用户明确提到"移动书籍"
- 涉及文件夹路径
- 可能是批量操作
```

### 5.2 Skills 同步机制

```typescript
// skills/index.ts
class SkillManager {
  private skillsDir: string
  private skills: Map<string, Skill> = new Map()

  async loadAll(): Promise<void> {
    const files = await fs.readdir(this.skillsDir)
    for (const file of files) {
      if (file.endsWith('.md')) {
        const skill = await this.parseSkill(file)
        this.skills.set(skill.name, skill)
      }
    }
  }

  async addSkill(skill: Skill): Promise<void> {
    const content = this.serializeSkill(skill)
    await fs.writeFile(path.join(this.skillsDir, `${skill.name}.md`), content)
    this.skills.set(skill.name, skill)
  }

  // Agent system prompt 用这些内容
  getSystemPromptAddition(): string {
    return this.skills
      .map(s => `## Skill: ${s.name}\n\n${s.description}\n\n参数：${JSON.stringify(s.paramTemplate)}`)
      .join('\n\n---\n\n')
  }
}
```

### 5.3 Skills 积累流程（完整生命周期）

```
用户："把科幻文件夹里的书移到刘慈欣文件夹"

    │
    ▼
Agent 接收
    │
    ▼
意图识别（Tool：route）
    │  匹配到"移动书籍"模式
    ▼
检查 Skills 列表
    │  没有命中已有 Skill
    ▼
进入 ReAct Loop
    │
    ├─ Step 1: get_file_list_by_folder("科幻")
    ├─ Step 2: filter(books) → [book1, book2, ...]
    ├─ Step 3: create_directory("刘慈欣")  （如不存在）
    ├─ Step 4~N: move_file(book1), move_file(book2), ...
    │
    ▼
执行完成
    │
    ▼
固化判断（Solidification Judge）
    │
    ├─ 步骤数 = N > 3        ✅
    ├─ 可参数化              ✅ → "把 X 文件夹的书移到 Y 文件夹"
    └─ 预期重复性            ✅
        │
        ▼
    写入 Skill MD
    路径：skills/move-books-between-folders.md
    内容：泛型描述 + 参数模板 + 执行步骤 + Agent 判断用条件
        │
        ▼
    后续对话
    Agent system prompt 自动包含新 Skill
    下次用户说"把文学类的书汇总到文学精选"
        │
        ▼
    意图识别
        │  命中 Skill: move-books-between-folders
        ▼
    直接执行 Skill（不再走 ReAct Loop）
    参数：{ sourceFolder: "文学类", destFolder: "文学精选" }
```

---

## 六、上下文与记忆管理

> **重要说明**：本节讨论范围仅限于**书架 Agent（Bookshelf Librarian）**。
> 人格 Agent（Persona Chat）有完全不同的上下文体系（RAG 上下文、角色扮演对话历史），
> 其上下文管理方案不在本节讨论范围内，需单独设计。

### 6.1 两种 Agent 的区分

| 维度 | 书架 Agent | 人格 Agent |
|------|-----------|-----------|
| **核心职责** | MCP 工具调度 + Skills 积累 | RAG 上下文注入 + 角色扮演 |
| **上下文来源** | Tools/Skills + 对话历史 | 书籍原文 RAG + Persona 系统 |
| **记忆形式** | Skills（MD 文件积累） | Persona 元数据 |
| **会话管理** | 独立管理，有列表和阈值提醒 | 独立管理 |
| **当前状态** | 方案 E 设计范围 | **未开始讨论** |

### 6.2 System Prompt 结构

书架 Agent 的 System Prompt 由以下部分组成，每次输入前完全重建：

```
System Prompt
├── 角色设定（你是书架 Agent，负责文件管理）
├── 可用 Tools 列表（name + description + schema）
├── 可用 Skills 列表（从 skills/ 目录加载全部）
└── 当前会话的对话历史（最近 N 条，含摘要）
```

**刷新策略**：
- 每次用户输入前，用最新的 Tools + Skills + 对话历史**完全重建** System Prompt
- Skills 持久保留，不受对话切换/压缩影响

### 6.3 对话历史管理

**组织形式**：
- 对话历史以列表形式展示，用户自主选择切换
- 每条记录默认显示**结果摘要**，用户点击可展开查看详细过程
- 展开内容：用户输入 → Agent 思考过程 → 工具调用记录 → 执行结果

**阈值提醒**：
- 当对话历史达到一定数量（如 20 条）时，弹出可消散气泡提示：
  "对话历史较多，可以开启新对话或压缩历史"
- 提醒可消失，不打断用户操作
- 具体压缩/切换操作由用户自主决定

**会话边界**：
- 对话历史按会话（Session）独立管理
- 新建会话时清空对话历史，保留 Skills
- 用户可主动切换会话，系统不自动合并

### 6.4 Skills 的持久性

- Skills 是跨会话积累的，存储在 `skills/` 目录的 MD 文件中
- 新建会话时，已有的 Skills 全部加载到 System Prompt
- Skills 不受对话历史压缩/切换影响
- Skills 的增删由 Agent 后台异步处理，对用户完全不透明

### 6.5 上下文窗口

- Token 计算使用 LLM API 的内置计数器或估算函数
- 当对话历史 token 接近上下文窗口时（软阈值），提示用户开新对话
- System Prompt 的常驻部分（Tools + Skills）优先保证完整
- 对话历史超出预算时，从最旧的记录开始截断

---

## 七、与方案 D 的明确区分

| 维度 | 方案 D | 方案 E |
|------|--------|--------|
| **意图识别** | 单步，5 种预设意图 | 多步，动态路由（Skill / Tools） |
| **Tools** | 4 个文件操作 | 10+ 个原子操作，可扩展 |
| **执行模式** | switch-case | ReAct Loop |
| **多步骤** | ❌ 不支持 | ✅ 支持（最多 10 步） |
| **Skills 积累** | ❌ 无 | ✅ MD 文件存储，后台自动固化 |
| **用户感知** | 纯工具 | 纯后台，用户无感知 |
| ** Skill 命中** | N/A | 命中则跳过 ReAct，直接执行 SOP |

---

## 八、关键设计决策

### 决策 1：Skill MD 文件用泛型描述而非代码

**选择**：Skill MD 是自然语言描述 + 参数模板，不含可执行代码。

**理由**：
- 安全：即使 LLM 被诱导，也无法通过 Skill MD 执行任意代码
- 简洁：不需要沙箱或代码执行环境
- Agent 自己理解描述并填充参数，保持了对执行过程的掌控

### 决策 2：Skills 存储在文件系统而非数据库

**选择**：`.md` 文件存储在 `skills/` 目录。

**理由**：
- 用户可直接查看/编辑 Skill（运维友好）
- Git 可追踪 Skill 演化历史
- 不引入额外依赖（SQLite/LevelDB）

### 决策 3：固化判断用 LLM 自主判断

**选择**：Agent 自主判断是否固化，用户完全不参与。

**理由**（来自用户）：
- Agent 是项目附加功能，作为控制工具应完全对用户不透明
- 用户不应感知 Skill 的存在和积累过程

### 决策 4：ReAct Loop 最大步数限制

**选择**：默认最大 10 步，防止无限循环。

**理由**：
- 书架管理任务不会需要超过 10 步的复杂操作
- 超过限制视为任务失败，避免死循环消耗 token
- 未来可通过 `maxSteps` 参数调整

---

## 九、待确认问题

### 人格 Agent（Persona Chat）上下文管理

> **状态：未开始讨论**
>
> 人格 Agent 的上下文管理与书架 Agent 完全不同，尚未讨论。
> 需要单独设计的内容包括：
> - RAG 上下文的注入策略（每轮还是按需？）
> - Persona 的记忆形式（是否需要长期记忆？用什么形式？）
> - 角色扮演对话历史的保留策略
> - System Prompt 中 Persona 的构成

---

### 实际待确认问题

- [x] **人格 Agent 上下文管理**：尚未讨论（见上方说明）
- [x] **Skills 目录结构**：两套 — 内置（`skills/` 进 git）+ 用户积累（`$USERDATA/skills/` 不进 git），各含 catalog.json
- [x] **Tools 具体列表**：已确认，见下方 Tools 清单
- [x] **Skill 命名规范**：kebab-case，无版本号（如 `move-books-between-folders`）
- [x] Skill MD 中的"执行步骤"：使用模板参数（选项 B），而非具体参数
- [x] 固化流程增加查重步骤：固化前检查是否已有功能重复的 Skill
- [x] Skills 目录位置：内置 `skills/` 在项目根目录；用户积累在 `$USERDATA/skills/`

---

*最后更新: 2026年3月30日（设计稿完成，待实现）*
