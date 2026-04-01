# 书架 Agent 架构方案

> **文档状态：讨论中（方案 E 设计阶段）**
>
> 本文档记录实现时的架构决策。现状：Librarian Agent 已基于**自研轻量意图识别循环**实现，使用 `@modelcontextprotocol/sdk` MCP 客户端，所有代码在 Electron 主进程运行，渲染进程通过 IPC 调用。

---

## 一、需求与约束

### 核心功能（已实现）

| 功能 | 状态 | 说明 |
|------|------|------|
| 聊天接口 | ✅ | 自然语言指令输入，结构化结果展示 |
| 书架管理 | ✅ | 列出书籍 / 创建文件夹 / 移动书籍 / 删除（需确认） |
| MCP 集成 | ✅ | `@modelcontextprotocol/sdk` StdioClientTransport |
| 意图识别 | ✅ | LLM 单步识别，temperature=0.1，JSON 输出 |
| 流式对话 | ✅ | OpenAI SDK streaming + ReadableStream 封装 |
| 安全保护 | ✅ | delete 二次确认、路径安全校验、intent 白名单 |

### 约束条件（来自 AGENT.md）

```
禁止使用：LangChain / Vercel AI SDK / LangGraph / AutoGen
必须使用：Electron 主进程 + MCP StdioClientTransport
```

### 未规划功能

- ~~Notion MCP 集成~~ — 未实现
- ~~Web Search~~ — 未实现
- ~~多轮 ReAct Loop~~ — 当前为单轮意图识别，不做多步规划
- ~~动态工具发现~~ — 工具集硬编码，不做开放插件架构

---

## 二、方案对比（重评）

> 以下评价基于**实际实现环境**：TypeScript + Electron + MCP，而非原文档的 Python + Flask 假设。

| 方案 | 复杂度 | 灵活性 | 扩展难度 | 依赖 | 推荐指数 |
|------|--------|--------|----------|------|----------|
| **A. Raw API** | ⭐ | ⭐⭐ | ⭐⭐ | 极轻 | ⭐⭐⭐ |
| **B. LangChain** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | 中等 | ❌（禁用） |
| **C. Vercel AI SDK** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 轻 | ❌（禁用） |
| **D. 自研轻量 Loop** | ⭐⭐ | ⭐⭐⭐ | ⭐ | 最轻 | ⭐⭐⭐⭐⭐ |

**禁用原因**：AGENT.md 明确禁止 LangChain 和 Vercel AI SDK，这两个方案直接排除。

---

## 三、实际架构（Librarian Agent）

### 架构图

```
用户输入（自然语言）
    │
    ▼
┌──────────────────────────────────────────────────┐
│           LibrarianBar Component                   │
│  (src/features/bookshelf/components/LibrarianBar) │
└────────────────────┬─────────────────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │     librarian-agent 服务层          │
    │  (src/features/bookshelf/services/ │
    │   librarian-agent.ts)               │
    │                                      │
    │  Step 1: recognizeIntent()          │
    │  → LLM temperature=0.1, JSON输出    │
    │  → parseJsonResponse() 解析          │
    │                                      │
    │  Step 2: switch(intent)              │
    │  → executeListFiles / executeMove    │
    │  → handleDeleteConfirmation          │
    └────────────────┬─────────────────────┘
                     │ window.electronAPI.mcp.*
    ┌────────────────▼─────────────────────┐
    │           Electron 主进程              │
    │                                      │
    │  McpManager (单例)                    │
    │  → StdioClientTransport               │
    │  → @modelcontextprotocol/sdk          │
    │                                      │
    │  文件操作：listFiles / moveFile /     │
    │            deleteFile / createDir     │
    └──────────────────────────────────────┘
```

### 核心代码结构

```
src/features/bookshelf/
├── components/
│   └── LibrarianBar.tsx       # UI入口：输入框 + 历史记录 + 删除确认
├── services/
│   └── librarian-agent.ts     # 核心逻辑：意图识别 + 工具编排
└── hooks/
    └── useLibrarian.ts       # React Hook：状态管理 + UI交互

electron/main/
├── mcp-manager.ts            # MCP 单例管理，StdioClientTransport
├── ipc-handlers.ts           # IPC 通道注册
└── rag-handler.ts           # RAG 引擎（与 Agent 独立）
```

### 意图识别流程（已实现）

```typescript
// librarian-agent.ts
export async function recognizeIntent(
  userInput: string,
  availablePaths: string[],
  llmConfig: LlmConfig,
  rootFolderNames: string[] = [],
): Promise<IntentRecognitionResult> {
  const systemPrompt = buildLibrarianSystemPrompt(availablePaths, rootFolderNames)
  const messages: Message[] = [
    { id: crypto.randomUUID(), role: 'system', content: systemPrompt, timestamp: 0 },
    { id: crypto.randomUUID(), role: 'user', content: userInput, timestamp: Date.now() },
  ]

  const stream = createLlmStream(messages, {
    ...llmConfig,
    stream: true,
    temperature: 0.1,   // 低随机性，确保 JSON 格式稳定
    maxTokens: 256,     // 意图 JSON 通常不超过 100 字符
  })

  const reader = stream.getReader()
  let fullContent = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) fullContent += value
  }

  return parseJsonResponse(fullContent)
}
```

### 工具路由（已实现）

```typescript
// librarian-agent.ts
switch (intentResult.intent) {
  case 'list_files':
    return { success: true, message: fileListText, operation: baseOp }
  case 'create_directory':
    await window.electronAPI.mcp.createDirectory(targetPath)
    return { success: true, message: `已创建文件夹 "${dirName}"`, operation: baseOp }
  case 'move_file':
    await window.electronAPI.mcp.moveFile(sourcePath, destPath)
    return { success: true, message: `已移动 "${fileName}" 到 "${destFolder}"`, operation: baseOp }
  case 'delete_file':
    // 不直接执行！返回需要确认的信号
    return { success: false, message: `即将删除 "${fileName}"，此操作不可撤销`,
             needsConfirmation: true, confirmationData: { intent: 'delete_file', path, fileName } }
  case 'unknown':
    return { success: false, message: '无法理解指令，请尝试「列出书籍」「创建文件夹」等表述', operation: baseOp }
}
```

### 安全保护层（已实现）

```typescript
// 1. intent 白名单校验
const validIntents = ['list_files', 'move_file', 'create_directory', 'delete_file', 'unknown']
if (!validIntents.includes(intent)) return { intent: 'unknown', ... }

// 2. 路径安全校验（禁止跨书架根目录操作）
function isRootDirectChildPath(rootPath: string, targetPath: string): boolean {
  const normalizedRoot = normalizePath(rootPath).replace(/\/+$/, '')
  const normalizedTarget = normalizePath(targetPath).replace(/\/+$/, '')
  if (!normalizedTarget.startsWith(`${normalizedRoot}/`)) return false
  const relative = normalizedTarget.slice(normalizedRoot.length + 1)
  if (!relative || relative.includes('/')) return false  // 禁止多级嵌套
  return true
}

// 3. delete 二次确认（不直接执行）
if (intent === 'delete_file') return { needsConfirmation: true, ... }
```

---

## 四、MCP 集成（已实现）

### 为什么用 @modelcontextprotocol/sdk 而非 raw subprocess

```
方案 A（raw subprocess）：自己解析 JSON-RPC，处理 stdin/stdout
  - 工作量：约 300 行 Python 代码
  - 问题：协议细节（id 管理、错误格式、批量调用）全部自己实现

方案 B（@modelcontextprotocol/sdk）：
  - 工作量：约 50 行 TypeScript
  - 优势：官方维护，协议细节完备，重试/超时/错误分类开箱即用
```

**实际选择**：方案 B（`@modelcontextprotocol/sdk`），因为它封装了 stdio 通信的繁琐细节，且 AGENT.md 禁止 LangChain 等重型框架，轻量 MCP 客户端是最优解。

### 已实现的 MCP 单例管理

```typescript
// electron/main/mcp-manager.ts
export class McpManager {
  private static instance: McpManager | null = null
  private client: Client | null = null
  private transport: StdioClientTransport | null = null

  public static getInstance(): McpManager {
    if (!McpManager.instance) McpManager.instance = new McpManager()
    return McpManager.instance
  }

  // 指数退避重连（2s → 4s → 8s）
  private async connectWithTimeout(timeoutMs = 10000): Promise<void> {
    return Promise.race([
      this._doConnect(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('MCP handshake timeout')), timeoutMs)
      ),
    ])
  }
}
```

---

## 五、方案回顾与重新评价

### 原文档方案 A（Raw OpenAI API + 硬编码 Tools）

**原评价**：Pros: 极简/零依赖；Cons: 手写 Loop/无流式

**重新评价**：
- 对 **Electron + TypeScript** 环境仍然适用
- 缺点（手写 Loop）在 Librarian Agent 中被接受——单轮识别不需要多步 Loop
- 流式支持通过 `ReadableStream` 封装解决，非阻塞 UI
- **结论**：适合当前场景，已采用

### 原文档方案 B（LangChain + 预定义 Tools）

**原评价**：Pros: Agent Loop 已封装/Tool Schema 自动生成；Cons: 依赖较重

**重新评价**：
- **AGENT.md 明确禁止**，不可使用
- 依赖体积与 Electron 桌面应用原则冲突
- **结论**：❌ 禁用

### 原文档方案 C（Vercel AI SDK + Server Actions）

**原评价**：Pros: 前后端一体/流式极简；Cons: 绑定 React 生态

**重新评价**：
- **AGENT.md 明确禁止**，不可使用
- Vercel AI SDK 的 `useChat` hook 确实优秀，但不适合 Electron 桌面场景
- **结论**：❌ 禁用

### 原文档方案 D（自研轻量 Agent Loop）

**原评价**：Pros: 比 A 结构化/比 B 更轻/完全自主；Cons: 需要自己实现流式/重试/超时

**重新评价**：
- **已采用**：Librarian Agent 几乎完全按此方案实现
- "需要自己实现" 的缺点在实践中影响不大：
  - 流式：封装 `createLlmStream()` 解决
  - 重试：MCP SDK 内置指数退避
  - 超时：MCP `connectWithTimeout` wrapper
- **结论**：✅ 最优选择

---

## 六、总结对比（更新后）

| 维度 | A | B | C | D（已采用） |
|------|---|---|---|---|
| **代码量** | 500-800行 | 300-500行 | 200-400行(TS) | 约 400行(TS) |
| **外部依赖** | openai SDK | langchain | @ai-sdk | @modelcontextprotocol/sdk |
| **学习成本** | 中 | 高 | 低 | 中 |
| **可维护性** | 高 | 中 | 高 | 高 |
| **灵活性** | 最高 | 中 | 中 | 高 |
| **推荐指数** | ⭐⭐⭐ | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| **是否可用** | ✅（可用） | ❌（禁用） | ❌（禁用） | ✅（已采用） |

**最终选择：方案 D（自研轻量意图识别循环）**

原因：
1. 满足"单 Agent + 预设工具 + 有限边界"需求
2. 不引入 LangChain/Vercel 等禁用依赖
3. 与 Electron 主进程架构天然契合（MCP SDK + IPC）
4. 代码量可控（~400行 TypeScript），完全自主可控

---

## 七、错误处理与健壮性

### LLM 错误分类（已实现）

```typescript
// electron/main/llm-handler.ts
type LlmErrorCode = 'invalid_key' | 'not_configured' | 'rate_limited'
  | 'network_error' | 'server_error' | 'not_found' | 'unknown'

function classifyError(error: unknown): LlmChatError {
  if (error instanceof OpenAI.AuthenticationError)
    return { code: 'invalid_key', ... }
  if (error instanceof OpenAI.RateLimitError)
    return { code: 'rate_limited', ... }
  if (error instanceof OpenAI.APIConnectionError)
    return { code: 'network_error', ... }
  if (error instanceof OpenAI.APIError) {
    if (status === 404)  // Base URL 路径错误
      return { code: 'not_found', message: '[404] 接口地址错误，请检查 Base URL（需包含完整路径，如 /v1/chat/completions）' }
    if (status && status >= 500) return { code: 'server_error', ... }
    // ...
  }
  return { code: 'unknown', ... }
}
```

### 流关闭安全处理（已实现）

```typescript
// src/shared/utils/llm-stream.ts
const removeComplete = window.electronAPI.llm.onChatComplete(() => {
  try { controller.close() } catch { /* ignore：stream 已 errored */ }
})
```

---

## 八、面试问答

**Q：为什么不直接让 LLM 执行文件操作，而是用意图识别 + switch？**

A：多步 ReAct 循环适合复杂任务（需要 LLM 自主规划步骤），但书架管理都是原子性单步操作（列目录/移动/删除），不需要 LLM 自主规划。意图识别的优势是：① 完全确定性——相同输入总产生相同操作，没有中间步骤的不确定性；② 调试简单——输入输出清晰可预测；③ 安全可控——intent 白名单 + 路径校验 + 二次确认，LLM 不会被"诱导"执行意外操作。

**Q：为什么 MCP 不用 raw subprocess 而用官方 SDK？**

A：raw subprocess 需要自己处理 JSON-RPC 协议细节（id 管理、错误序列化、批量调用、超时重试），约 300 行代码且协议行为不确定。MCP SDK 约 50 行搞定，官方维护，协议行为可靠，重试逻辑开箱即用。

**Q：意图识别输出的 JSON 不稳定怎么办？**

A：三阶段兜底解析：① `JSON.parse()` 直接解析；② 移除 markdown 代码块后解析；③ 正则提取第一个 `{...}` 块。无论如何都会返回一个有效结果（fallback 为 `intent: 'unknown'`），不会因为 LLM 输出格式问题导致功能崩溃。

---

*最后更新: 2026年3月29日（基于 v2 架构实现）*

---

## 附：方案 E 设计讨论记录

> 以下为设计讨论过程中的要点记录，待方案 E 敲定后整理入正文。

### 讨论要点（2026-03-29）

**背景：**
- 方案 D（单步意图识别）已实现，支持 5 种预设意图
- 局限：无法处理"把 a 文件夹里的书都移到 b 文件夹"这类多步骤指令
- 目标：方案 E 需要支持自由描述 → 工具调度 → 多步骤执行 → Skill 固化

**核心三层架构（已达成共识）：**

```
用户输入
    │
    ▼
┌──────────────────────────────────────┐
│         Agent（调度层）                  │
│                                        │
│  意图识别 → 判断路由                      │
│    ├─ 命中 Skill → 直接执行              │
│    └─ 未命中 → 组合 Tools 执行            │
│                                        │
│  多步执行循环（ReAct Loop）               │
│  完成后判断是否值得固化                    │
└──────────────────┬───────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
 Tools(原子)   Skills(SOP)    Skills存储
 (MD文件)                    (.md in /skills)
```

**Tools（原子操作）：**
- 需扩展至覆盖更多操作（不仅是文件 CRUD）
- 是 Agent 自由组合的最小单元

**Skills（固化 SOP）：**
- 触发条件：多步任务完成后，Agent 判断是否值得固化
- 门禁机制：一次性任务不固化，只有"可重复的模式"才固化
- 格式：泛型描述 + 参数模板
  - 例："把文件夹 A 的书移到 B" → 固化为"把文件夹 X 的书移到文件夹 Y"
  - Agent 读取 Skill 描述后，用当前参数填充执行

**Skills 积累流程：**
1. 用户发起多步任务 → Agent 组合 Tools 执行
2. 任务完成 → Agent 判断是否值得固化
3. 值得固化 → Agent 生成 MD 文件（泛型描述 + 参数模板）
4. 存入 `/skills` 目录
5. 后续对话 system prompt 同步 Skills 列表
6. 后台异步处理（不阻塞当前对话）

**待确认问题：**
- [ ] Skill MD 文件的具体格式（泛型描述 + 参数模板的精确结构）
- [ ] 固化的判断标准（Agent 如何判断"这值得固化"？）
- [ ] Skills 的最大数量限制（防止 Skill 过多导致 prompt 膨胀）
- [ ] Tools 需要扩展到哪些操作（当前只有文件 CRUD）

