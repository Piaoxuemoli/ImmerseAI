# ImmerseAI 项目开发宪法 (Project Constitution) v1.0

> **文档性质**：本文档是 ImmerseAI 项目的**最高级别设计约束**。所有 AI 辅助编程工具（Cursor / Windsurf / Copilot）生成的代码必须严格遵守本文档定义的技术边界、架构规范和核心逻辑。任何与本文档冲突的代码均视为**违宪**，需立即修正。

---

## 第一章：项目愿景与核心原则 (Vision & Core Principles)

### 1.1 项目定义

**ImmerseAI** 是一款 **Local-First（本地优先）** 的沉浸式阅读与角色扮演 Agent 桌面应用。

它通过 **MCP (Model Context Protocol)** 连接本地书库，利用 **端侧 RAG** 技术理解书籍内容，并允许用户通过 **LLM** 创建"书中角色"进行跨时空对话。

### 1.2 三大不可违背的核心原则

| 原则编号      | 原则名称     | 定义                                                                                                            | 违宪示例                                   |
| ------------- | ------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **P-1** | 数据主权     | 书籍文件与向量索引**完全本地化**，零隐私泄露。唯一出站流量是 LLM API 调用。                               | ❌ 将书籍内容上传至云端进行向量化          |
| **P-2** | UI 零阻塞    | 任何计算密集型操作（向量化、文本切分）必须在**Web Worker** 中执行，**严禁**在渲染进程或主进程执行。 | ❌ 在 React 组件中直接调用 Transformers.js |
| **P-3** | Agentic 能力 | Agent 不仅能聊天，还必须具备**副作用能力**：管理文件系统（MCP Tools）、记录笔记（write_file）。           | ❌ Agent 只有对话功能，不能操作文件        |

### 1.3 设计哲学

```
"读书不觉已春深，一寸光阴一寸金。" —— 沉浸，是最高的尊重。
```

- **极简主义 (Minimalism)**：Notion 风格，黑白灰主色调，内容为王
- **渐进式复杂度 (Progressive Complexity)**：用户首次使用只需拖入一本书，高级功能自然发现
- **可预测性 (Predictability)**：Agent 的每个动作都必须对用户透明，可撤销

---

## 第二章：技术栈宪法 (Tech Stack Constitution)

### 2.1 确定选型（不可更改）

```yaml
# ===== 核心框架 =====
Runtime:          Electron v28+
Frontend:         React v18+ (Functional Components ONLY, NO Class Components)
Language:         TypeScript (strict mode, NO any)
Bundler:          Vite v5+

# ===== UI 层 =====
Styling:          TailwindCSS v3+
Component Lib:    shadcn/ui (Radix UI primitives)
Icons:            lucide-react
Animation:        framer-motion
Font:             Inter / System UI

# ===== 状态管理 =====
Global State:     Zustand v4+ (with persist middleware for critical state)
Server State:     TanStack Query v5 (for LLM API calls & MCP calls)

# ===== Agent 协议层 =====
MCP SDK:          @modelcontextprotocol/sdk
MCP Server:       @modelcontextprotocol/server-filesystem (Local)
                  @modelcontextprotocol/server-github (Future Remote)

# ===== 本地 RAG 引擎 =====
Embedding Model:  @xenova/transformers (all-MiniLM-L6-v2, quantized)
Vector Database:  @orama/orama (in-memory + IndexedDB persistence)
Text Splitter:    LangChain.js (RecursiveCharacterTextSplitter ONLY)

# ===== LLM 集成 =====
API Protocol:     OpenAI Compatible API
Providers:        DeepSeek / Kimi / Moonshot / OpenAI (user-configurable)
SDK:              openai (official Node.js SDK)

# ===== 电子书 =====
EPUB Rendering:   react-reader (based on epub.js)
```

### 2.2 禁止使用清单（红线）

| 禁止项                                  | 原因                                      |
| --------------------------------------- | ----------------------------------------- |
| `Redux` / `MobX`                    | 过重，Zustand 已满足需求                  |
| `Next.js` / `Nuxt`                  | 本项目是桌面端 Electron 应用，非 Web 应用 |
| `Prisma` / `TypeORM`                | 无需传统数据库，使用 IndexedDB + Orama    |
| `Tailwind @apply` 大量使用            | 违反 Tailwind 原子化理念，直接在 JSX 中写 |
| `CSS Modules` / `Styled Components` | 已选定 TailwindCSS，不引入其他样式方案    |
| `axios`                               | 使用原生 `fetch` 或 `openai` SDK      |
| `moment.js`                           | 使用 `date-fns` 或原生 `Intl`         |
| `lodash` 整体引入                     | 如需使用，仅 tree-shaking 引入单个函数    |

---

## 第三章：系统架构设计 (System Architecture)

### 3.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    ImmerseAI Application                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           渲染进程 (Renderer Process)                      │    │
│  │                                                           │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │    │
│  │  │ Bookshelf│  │  Reader  │  │   Chat   │  React App   │    │
│  │  │   Page   │  │   Page   │  │   Page   │              │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘              │    │
│  │       │              │              │                     │    │
│  │  ┌────┴──────────────┴──────────────┴─────┐             │    │
│  │  │         Zustand State Store             │             │    │
│  │  └────────────────┬───────────────────────┘             │    │
│  └───────────────────┼─────────────────────────────────────┘    │
│                      │                                           │
│  ┌───────────────────┼─────────┐  ┌──────────────────────────┐ │
│  │    Web Worker      │          │  │   主进程 (Main Process)   │ │
│  │   (计算层)         │          │  │      (桥接层)              │ │
│  │                    ▼          │  │                           │ │
│  │  ┌──────────────────────┐   │  │  ┌─────────────────────┐ │ │
│  │  │  RAG Engine          │   │  │  │  IPC Handler        │ │ │
│  │  │  ┌────────────────┐  │   │  │  └──────┬──────────────┘ │ │
│  │  │  │ Transformers.js│  │   │  │         │                 │ │
│  │  │  │ (Embedding)    │  │   │  │  ┌──────┴──────────────┐ │ │
│  │  │  └────────────────┘  │   │  │  │  MCP Client         │ │ │
│  │  │  ┌────────────────┐  │   │  │  │  (McpManager)       │ │ │
│  │  │  │ Orama VectorDB │  │   │  │  └──────┬──────────────┘ │ │
│  │  │  │ (+ IndexedDB)  │  │   │  │         │                 │ │
│  │  │  └────────────────┘  │   │  │  ┌──────┴──────────────┐ │ │
│  │  └──────────────────────┘   │  │  │  LLM API Handler    │ │ │
│  └─────────────────────────────┘  │  └──────┬──────────────┘ │ │
│                                    │         │                 │ │
│                                    └─────────┼─────────────────┘ │
│                                              │                    │
└──────────────────────────────────────────────┼────────────────────┘
                                               │
                    ┌──────────────────────────┼────────────────┐
                    │         外部系统          │                 │
                    │                          ▼                 │
                    │  ┌──────────────┐  ┌──────────────┐      │
                    │  │ MCP Server   │  │ LLM API      │      │
                    │  │ (Subprocess) │  │ (DeepSeek/   │      │
                    │  │              │  │  Kimi/etc.)  │      │
                    │  └──────┬───────┘  └──────────────┘      │
                    │         │                                  │
                    │  ┌──────┴───────┐                         │
                    │  │ Local Disk   │                         │
                    │  │ (Books/Notes)│                         │
                    │  └──────────────┘                         │
                    └───────────────────────────────────────────┘
```

### 3.2 四层架构详解

#### Layer 1: 渲染进程 (Renderer Process) — 表现层

| 职责         | 实现                                              |
| ------------ | ------------------------------------------------- |
| 用户界面渲染 | React + TailwindCSS + shadcn/ui                   |
| 全局状态管理 | Zustand（书籍列表、阅读进度、对话历史、当前角色） |
| 路由管理     | react-router-dom v6                               |
| 用户输入处理 | 表单、快捷键、拖拽                                |

**规则**：

- 渲染进程**只做 UI 呈现和状态管理**
- **禁止**在渲染进程中直接调用 Node.js API
- 所有 IPC 调用必须通过 `preload.ts` 暴露的安全 API

#### Layer 2: Web Worker (计算层) — 智能层

| 职责       | 实现                      |
| ---------- | ------------------------- |
| 文本向量化 | @xenova/transformers      |
| 向量检索   | @orama/orama              |
| 文本切分   | LangChain.js TextSplitter |
| 索引持久化 | IndexedDB                 |

**规则**：

- Worker **是唯一允许运行 ML 模型的地方**
- Worker 通过 `postMessage` 与渲染进程通信
- 模型加载必须是**单例模式**，仅首次调用时加载

#### Layer 3: 主进程 (Main Process) — 桥接层

| 职责         | 实现                                |
| ------------ | ----------------------------------- |
| IPC 路由分发 | Electron ipcMain handlers           |
| MCP 协议通信 | @modelcontextprotocol/sdk Client    |
| LLM API 转发 | openai SDK（在主进程调用避免 CORS） |
| 安全存储     | Electron safeStorage（API Keys）    |
| 窗口管理     | BrowserWindow lifecycle             |

**规则**：

- 主进程**不做任何计算密集型操作**
- MCP Server 作为**子进程 (Sidecar)** 运行
- API Key **永远不传递到渲染进程**，仅在主进程中使用

#### Layer 4: 外部系统 — 数据层

| 组件                  | 通信方式         | 说明               |
| --------------------- | ---------------- | ------------------ |
| MCP Filesystem Server | Stdio (JSON-RPC) | 子进程，无网络延迟 |
| MCP GitHub Server     | Stdio (JSON-RPC) | 未来扩展           |
| LLM API               | HTTPS            | 唯一的出站网络流量 |
| Local Disk            | 通过 MCP Server  | 书籍、笔记、配置   |

### 3.3 MCP 架构定义

```typescript
/**
 * MCP 运行形态定义
 * 
 * 运行模式: Local Subprocess (Sidecar Pattern)
 * 通信协议: Stdio (Standard I/O) — JSON-RPC 2.0
 * 安全边界: MCP Server 仅能访问用户显式授权的目录
 */

// McpManager 单例 — 管理所有 MCP 连接的生命周期
class McpManager {
  private client: Client | null = null;
  
  // 本地模式：挂载用户选定的本地目录
  async connectLocal(path: string): Promise<void>;
  
  // 远程模式（未来）：通过 PAT 连接 GitHub
  async connectGithub(repoUrl: string, token: string): Promise<void>;
  
  // 统一资源接口：屏蔽底层差异
  async readResource(uri: string): Promise<ResourceContent>;
  
  // 统一工具接口
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  
  // 生命周期
  async disconnect(): Promise<void>;
}
```

**Token 安全规则**：

- GitHub PAT 存储在 `Electron safeStorage` 中
- 仅在启动 MCP 子进程时通过**环境变量**注入
- **禁止**将 Token 写入配置文件或日志

### 3.4 数据流转全景图

```
用户操作                    数据流转路径
─────────                   ──────────────

[搜索/对话]     →  Renderer → postMessage → Web Worker (RAG)
                                               ↓
                                          Orama 向量检索
                                               ↓
                                          返回相关片段
                                               ↓
                   Renderer ← postMessage ← Web Worker

[文件管理]      →  Renderer → IPC → Main Process
                                        ↓
                                   MCP Client
                                        ↓ (Stdio JSON-RPC)
                                   MCP Server (子进程)
                                        ↓
                                   Local Filesystem
                                        ↓
                   Renderer ← IPC ← Main Process

[AI 对话]       →  Renderer → IPC → Main Process
                                        ↓
                                   LLM API Handler
                                        ↓ (HTTPS SSE)
                                   DeepSeek / Kimi API
                                        ↓ (Stream)
                   Renderer ← IPC (stream) ← Main Process

[导入书籍]      →  Renderer → IPC → Main Process (MCP read)
                                        ↓
                   获取 EPUB 文件流
                                        ↓
                   Renderer → postMessage → Web Worker
                                               ↓
                                          解析 → 切分 → 向量化 → 存储
                                               ↓
                   Renderer ← postMessage ← Worker (索引完成)
```

---

## 第四章：核心模块详细设计 (Core Modules)

### 4.1 模块一：Librarian Agent (书架管理)

#### 4.1.1 模块职责

管理用户的本地书库，提供 AI 辅助的书籍整理能力。

#### 4.1.2 交互模式

- **视觉层**：Dashboard 网格视图（书籍封面墙）
- **Agent 层**：底部固定的 Librarian 聊天输入框

#### 4.1.3 MCP 工具链映射

| 用户意图               | Agent 解析 | MCP Tool             | 参数                          |
| ---------------------- | ---------- | -------------------- | ----------------------------- |
| "显示我的书架"         | 列出文件   | `list_directory`   | `{ path: "/mounted/path" }` |
| "把三体放到科幻文件夹" | 移动文件   | `move_file`        | `{ source, destination }`   |
| "新建一个'哲学'分类"   | 创建目录   | `create_directory` | `{ path }`                  |
| "删除这本书"           | 删除文件   | `delete_file`      | `{ path }` (需二次确认)     |

#### 4.1.4 Bookshelf Connector（书架连接器）

```typescript
/**
 * 书架连接器 — McpManager 的上层抽象
 * 
 * 职责：
 * 1. 管理 MCP 连接生命周期 (Connect / Disconnect / Switch)
 * 2. 统一 Local 和 GitHub 的资源访问接口
 * 3. 缓存文件列表，减少重复 MCP 调用
 */
interface BookshelfConnector {
  // 连接状态
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  currentSource: 'local' | 'github' | null;
  
  // 连接管理
  mountLocal(directoryPath: string): Promise<void>;
  mountGithub(repoUrl: string): Promise<void>;  // Future
  unmount(): Promise<void>;
  
  // 统一资源操作（屏蔽底层差异）
  listBooks(): Promise<BookFile[]>;
  readBook(bookPath: string): Promise<ArrayBuffer>;
  moveBook(source: string, destination: string): Promise<void>;
  writeNote(path: string, content: string): Promise<void>;
}
```

#### 4.1.5 逻辑流程

```
用户点击"挂载书架"
        │
        ▼
  选择本地文件夹 (Electron dialog.showOpenDialog)
        │
        ▼
  Main Process: McpManager.connectLocal(selectedPath)
        │
        ▼
  启动子进程: npx @modelcontextprotocol/server-filesystem <path>
        │
        ▼
  MCP Client 握手成功 → 状态更新为 'connected'
        │
        ▼
  自动调用 list_directory → 解析 .epub 文件 → 生成 Book[] 列表
        │
        ▼
  渲染进程: Zustand Store 更新 → 网格视图渲染书籍封面
```

---

### 4.2 模块二：Local RAG Engine (本地大脑)

#### 4.2.1 模块职责

在 Web Worker 中运行的**纯本地语义检索引擎**，负责书籍内容的理解、索引和检索。

#### 4.2.2 运行环境约束

```
⚠️ 强制规则：RAG Engine 的所有代码必须在 Web Worker 中运行。
             渲染进程仅通过 postMessage 与其通信。
             违反此规则等同于违反核心原则 P-2。
```

#### 4.2.3 索引流程 (Ingestion Pipeline)

```
Step 1: Lazy Load (懒加载)
  ┌─────────────────────────────────────┐
  │ 触发: 用户首次点击某本书              │
  │ 动作: MCP read_file → EPUB ArrayBuffer│
  │ 传递: Renderer → postMessage → Worker │
  └─────────────────────────────────────┘
              │
              ▼
Step 2: Parsing (解析)
  ┌─────────────────────────────────────┐
  │ 工具: epub.js                        │
  │ 输出: Chapter[] (纯文本, 保留 CFI)    │
  │ CFI: epub 内容定位符，用于跳转         │
  └─────────────────────────────────────┘
              │
              ▼
Step 3: Chunking (切分)
  ┌─────────────────────────────────────┐
  │ 工具: RecursiveCharacterTextSplitter │
  │ 参数:                                │
  │   chunkSize: 500                     │
  │   chunkOverlap: 50                   │
  │   separators: ["\n\n", "\n", "。", " "]│
  │ 输出: Chunk[] (text + metadata)      │
  └─────────────────────────────────────┘
              │
              ▼
Step 4: Embedding (向量化)
  ┌─────────────────────────────────────┐
  │ 模型: all-MiniLM-L6-v2 (quantized)  │
  │ 维度: 384                            │
  │ 加载: 单例模式 (首次调用时加载)        │
  │ 输出: Float32Array[384]              │
  └─────────────────────────────────────┘
              │
              ▼
Step 5: Indexing (索引存储)
  ┌─────────────────────────────────────┐
  │ 引擎: Orama                          │
  │ Schema: { text, vector, cfi, chapter }│
  │ 持久化: IndexedDB (Key: book_{id})    │
  └─────────────────────────────────────┘
```

#### 4.2.4 检索接口

```typescript
// Worker 接收的消息类型
type WorkerMessage =
  | { type: 'ingest'; bookId: string; chapters: Chapter[] }
  | { type: 'search'; bookId: string; query: string; topK?: number }
  | { type: 'status'; bookId: string };

// Worker 返回的消息类型
type WorkerResponse =
  | { type: 'ingest:progress'; bookId: string; progress: number } // 0-100
  | { type: 'ingest:complete'; bookId: string; chunkCount: number }
  | { type: 'search:result'; results: SearchResult[] }
  | { type: 'status:result'; isIndexed: boolean }
  | { type: 'error'; message: string };

interface SearchResult {
  text: string;           // 匹配的文本片段
  cfi: string;            // epub 定位符（用于跳转）
  chapter: string;        // 所属章节名
  score: number;          // 相似度分数 (0-1)
}
```

#### 4.2.5 缓存策略

```
首次打开书籍:
  检查 IndexedDB 中是否存在 key="book_{id}" 的索引
    ├── 存在 → 直接加载到 Orama 内存 → 0 秒启动 ✅
    └── 不存在 → 执行完整 Ingestion Pipeline → 完成后持久化
```

---

### 4.3 模块三：Actor Agent (角色扮演)

#### 4.3.1 模块职责

提供沉浸式的书中角色对话体验，包括自动人设生成和上下文感知的对话。

#### 4.3.2 状态机 (FSM)

```
                    ┌──────────┐
         ┌─────────│   Idle   │◄────────────┐
         │         └────┬─────┘             │
         │              │                    │
         │    用户输入角色名 / 点击配置         │ 用户退出角色
         │              │                    │
         │              ▼                    │
         │    ┌──────────────────┐          │
         │    │   Configuring    │          │
         │    │  (生成/修改人设)   │          │
         │    └────────┬─────────┘          │
         │             │                     │
         │    用户确认保存人设                  │
         │             │                     │
         │             ▼                     │
         │    ┌──────────────────┐          │
         └───►│   RolePlaying    │──────────┘
              │  (沉浸对话模式)    │
              └──────────────────┘
```

#### 4.3.3 功能 A：自动化人设生成 (Auto-Persona)

```
用户输入: "章北海"
         │
         ▼
  Step 1: RAG 多维度检索
  ┌──────────────────────────────────────┐
  │ 并发执行以下查询:                       │
  │  • search("章北海 性格特征")             │
  │  • search("章北海 经典台词 名言")        │
  │  • search("章北海 关键事件 结局")        │
  │ 合并去重 → context_chunks[]            │
  └──────────────────────────────────────┘
         │
         ▼
  Step 2: LLM Prompt 组装
  ┌──────────────────────────────────────┐
  │ System: 你是一个角色分析专家...          │
  │ User: 基于以下原文片段，生成角色设定:     │
  │       {context_chunks}               │
  │       要求返回 JSON:                   │
  │       { name, personality, speech_style,│
  │         key_quotes, background }       │
  └──────────────────────────────────────┘
         │
         ▼
  Step 3: 结果回填
  ┌──────────────────────────────────────┐
  │ 解析 LLM JSON 响应                     │
  │ 生成 systemPrompt                     │
  │ 填入 Persona 配置框 → 用户确认/修改     │
  └──────────────────────────────────────┘
```

#### 4.3.4 功能 B：沉浸式对话

**System Prompt 模板**（不可修改的结构）：

```typescript
const IMMERSIVE_SYSTEM_PROMPT = `
你现在是 {role_name}。以下是你的角色设定：

【身份背景】
{persona_background}

【性格特征】
{persona_personality}

【说话风格】
{persona_speech_style}

【当前上下文（来自书籍原文）】
---
{rag_context}
---

【行为准则】
1. 你必须完全带入角色，用第一人称回答。
2. 你的回答必须与书中角色的性格和经历一致。
3. 如果用户问到书中未涉及的内容，你可以基于角色性格合理推演，但需注明"这是我的推测"。
4. 绝对不要暴露你是 AI，不要使用"作为一个AI"等表述。
5. 当引用书中原文时，保持原句不变。
`;
```

#### 4.3.5 MCP 工具集成

| 对话触发         | Agent 动作              | MCP Tool         |
| ---------------- | ----------------------- | ---------------- |
| "帮我记个笔记"   | 生成 Markdown 写入本地  | `write_file`   |
| "这段话出自哪里" | RAG 检索 + 返回 CFI     | 内部 Worker 调用 |
| "总结一下这章"   | RAG 检索整章 + LLM 总结 | 内部流程         |

---

## 第五章：数据结构定义 (Data Schemas)

> ⚠️ **宪法级约束**：以下 TypeScript 接口定义是本项目的**数据契约**。
> 所有生成的代码必须严格遵守这些接口，不得擅自增删字段。

### 5.1 核心数据模型

```typescript
// ============================================
// 书籍元数据
// ============================================
interface Book {
  id: string;                // UUID v4
  title: string;             // 书名
  author: string;            // 作者
  path: string;              // 本地绝对路径 (通过 MCP 获取)
  coverUrl?: string;         // 封面图 Base64 或本地路径
  isIndexed: boolean;        // 是否已完成向量化索引
  indexedAt?: number;        // 索引完成时间戳
  lastReadAt?: number;       // 上次阅读时间戳
  lastReadCfi?: string;      // 上次阅读位置 (epub CFI)
  chunkCount?: number;       // 索引片段总数
}

// ============================================
// 角色设定
// ============================================
interface Persona {
  id: string;                // UUID v4
  bookId: string;            // 关联的书籍 ID
  name: string;              // 角色名称
  description: string;       // 用户输入的简述 / LLM 生成的摘要
  personality: string;       // 性格特征
  speechStyle: string;       // 说话风格
  background: string;        // 背景故事
  keyQuotes: string[];       // 代表性台词
  systemPrompt: string;      // 最终生成的完整 System Prompt
  avatar?: string;           // 头像 (可选, emoji 或图片路径)
  createdAt: number;         // 创建时间
  updatedAt: number;         // 更新时间
}

// ============================================
// 聊天消息
// ============================================
interface Message {
  id: string;                // UUID v4
  role: 'user' | 'assistant' | 'system';
  content: string;           // 消息内容 (支持 Markdown)
  timestamp: number;         // 发送时间戳
  personaId?: string;        // 关联的角色 ID (assistant 消息)
  // 引用来源 (用于点击跳转到原文)
  citations?: Citation[];
}

interface Citation {
  cfi: string;               // epub 定位符 (用于阅读器跳转)
  text: string;              // 原文片段
  chapter: string;           // 所属章节名
  score: number;             // 相似度分数 (0-1)
}

// ============================================
// 对话会话
// ============================================
interface ChatSession {
  id: string;                // UUID v4
  bookId: string;            // 关联书籍
  personaId: string;         // 关联角色
  messages: Message[];       // 消息列表
  createdAt: number;
  updatedAt: number;
}

// ============================================
// 应用配置
// ============================================
interface AppConfig {
  llm: {
    provider: 'deepseek' | 'kimi' | 'moonshot' | 'openai' | 'custom';
    apiKey: string;          // 加密存储在 safeStorage 中
    baseUrl: string;         // API 端点
    model: string;           // 模型名称
    temperature: number;     // 0.0 - 1.0, 默认 0.7
    maxTokens: number;       // 最大生成长度, 默认 2048
  };
  bookshelf: {
    rootPath: string;        // 书架根目录
    sourceType: 'local' | 'github';
  };
  ui: {
    theme: 'light' | 'dark'; // 未来扩展
    fontSize: number;        // 阅读器字号
  };
}

// ============================================
// MCP 相关类型
// ============================================
interface BookFile {
  name: string;              // 文件名
  path: string;              // 相对路径
  size: number;              // 文件大小 (bytes)
  type: 'epub' | 'pdf' | 'txt' | 'unknown';
  lastModified: number;      // 最后修改时间
}
```

### 5.2 Zustand Store 结构

```typescript
interface ImmerseStore {
  // === 书架状态 ===
  books: Book[];
  selectedBookId: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  
  // === 阅读器状态 ===
  currentCfi: string | null;
  readerMode: 'read' | 'chat';
  
  // === 角色状态 ===
  personas: Persona[];
  activePersonaId: string | null;
  
  // === 对话状态 ===
  currentSession: ChatSession | null;
  isGenerating: boolean;     // LLM 是否正在生成
  
  // === RAG 状态 ===
  indexingProgress: Record<string, number>; // bookId -> 0-100
  
  // === Actions ===
  setBooks: (books: Book[]) => void;
  selectBook: (bookId: string) => void;
  addMessage: (message: Message) => void;
  setPersona: (persona: Persona) => void;
  toggleMode: () => void;
  // ... 更多 actions
}
```

---

## 第六章：UI 设计规范 (UI Design Specification)

### 6.1 设计语言

```yaml
Design System: "Notion Minimal"

Colors:
  Primary Text:    slate-900 (#0f172a)
  Secondary Text:  slate-500 (#64748b)
  Background:      white (#ffffff) / slate-50 (#f8fafc)
  Border:          slate-200 (#e2e8f0)
  Accent:          slate-800 (#1e293b)  # 仅用于重要按钮和图标
  Error:           red-500 (#ef4444)
  Success:         green-500 (#22c55e)
  
Typography:
  Font Family:     Inter, system-ui, sans-serif
  Heading:         font-semibold
  Body:            font-normal
  
Spacing:
  Consistent 4px grid (p-1, p-2, p-4, p-6, p-8)
  
Borders:
  Radius:          rounded-lg (8px) for cards, rounded-md (6px) for buttons
  Width:           border (1px), always slate-200
  
Shadows:
  Minimal usage. Only shadow-sm for elevated elements (dialogs, dropdowns)
```

### 6.2 书架页 (Bookshelf Dashboard)

```
┌──────────────────────────────────────────────────────────┐
│  ◉ ImmerseAI                    [⚙️] [📥 Import] [🔗 GitHub] │  ← Header
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │      │  │      │  │      │  │      │  │      │    │
│  │ Cover│  │ Cover│  │ Cover│  │ Cover│  │ Cover│    │
│  │      │  │      │  │      │  │      │  │      │    │  ← Scrollable
│  │      │  │      │  │      │  │      │  │      │    │    Grid
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘    │
│  三体      活着      百年孤独   红楼梦     1984      │
│  刘慈欣    余华      马尔克斯   曹雪芹     奥威尔     │
│                                                          │
│  ┌──────┐  ┌──────┐                                     │
│  │      │  │  +   │  ← Empty state: "拖入 EPUB 文件"    │
│  │ Cover│  │ Add  │                                     │
│  │      │  │      │                                     │
│  └──────┘  └──────┘                                     │
│  鲁迅全集                                                │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  🤖 Ask Librarian...                           [Send ➤] │  ← Fixed Bottom
│  "把所有三体小说放到 Sci-Fi 文件夹"                        │     Librarian Bar
└──────────────────────────────────────────────────────────┘
```

**书架页组件结构**：

```
<BookshelfPage>
  <TopBar />                          // Logo + Action Buttons
  <ScrollArea>
    <BookGrid>
      <BookCard /> × N                // 2:3 宽高比封面卡片
    </BookGrid>
  </ScrollArea>
  <LibrarianBar />                    // 固定底部聊天输入
</BookshelfPage>
```

### 6.3 阅读页 (Reader View)

```
┌──────────────────────────────────────────────────────────┐
│  [← Back]     《三体》         [👤 Persona] [📖⇄💬 Mode] │  ← Header
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │           MODE: READ                               │  │
│  │                                                    │  │
│  │     "面壁者罗辑最终明白了黑暗森林法则的              │  │
│  │      真正含义。宇宙就是一座黑暗森林，每个             │  │
│  │      文明都是带枪的猎人..."                          │  │
│  │                                                    │  │
│  │           ─── OR ───                               │  │
│  │                                                    │  │
│  │           MODE: CHAT                               │  │
│  │                                                    │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ 🧑 你作为面壁者，最初知道真相时是什么感受？    │  │  │
│  │  ├─────────────────────────────────────────────┤  │  │
│  │  │ 🤖 章北海:                                   │  │  │
│  │  │ "当我第一次理解黑暗森林法则时，我感到的         │  │  │
│  │  │  不是恐惧，而是一种冷静的确认..."              │  │  │
│  │  │  📎 引用: 第23章 "黑暗森林" [点击跳转]        │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────┐ [Send ➤]  │  ← Chat Input
│  │ Say something to 章北海...                │           │     (Chat Mode)
│  └──────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────┘
```

**阅读页组件结构**：

```
<ReaderPage>
  <ReaderHeader />                    // Back + Title + Persona + Mode Toggle
  <AnimatePresence>                   // framer-motion 过渡
    {mode === 'read' && <EpubReader />}    // react-reader 渲染区
    {mode === 'chat' && <ChatInterface />} // 对话界面
  </AnimatePresence>
  {mode === 'chat' && <ChatInput />}       // 聊天输入框
  <PersonaConfigDialog />                   // 角色配置弹窗 (shadcn Dialog)
</ReaderPage>
```

### 6.4 角色配置弹窗 (Persona Config Dialog)

```
┌─────────────────────────────────────────┐
│          🎭 角色配置                 [×] │
├─────────────────────────────────────────┤
│                                         │
│  角色名称                               │
│  ┌─────────────────────────────────┐   │
│  │ 章北海                           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  角色描述                               │
│  ┌─────────────────────────────────┐   │
│  │ 三体中的军人角色，坚定的太空       │   │
│  │ 军事战略家...                     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [✨ 一键生成人设]                       │  ← 调用 RAG + LLM
│                                         │
│  ─────── 生成的详细设定 ───────          │
│                                         │
│  性格特征: 冷静、果断、有远见...          │
│  说话风格: 简洁有力，军人气质...          │
│  代表台词: "不要让人类的感情左右..."      │
│                                         │
│           [保存角色]  [取消]             │
└─────────────────────────────────────────┘
```

---

## 第七章：项目目录结构 (Project Structure)

```
immerseai/
├── electron/                          # Electron 主进程代码
│   ├── main/
│   │   ├── index.ts                   # 主进程入口
│   │   ├── ipc-handlers.ts            # IPC 路由注册
│   │   ├── mcp-manager.ts             # MCP Client 管理器 (单例)
│   │   ├── llm-handler.ts             # LLM API 调用处理
│   │   └── safe-storage.ts            # API Key 安全存储
│   └── preload/
│       └── index.ts                   # preload 脚本 (contextBridge)
│
├── src/                               # 渲染进程 (React App)
│   ├── app/
│   │   ├── App.tsx                    # 根组件
│   │   ├── router.tsx                 # 路由配置
│   │   └── providers.tsx              # Provider 组合
│   │
│   ├── features/                      # 功能模块 (Feature-based)
│   │   ├── bookshelf/                 # 书架功能
│   │   │   ├── components/
│   │   │   │   ├── BookGrid.tsx
│   │   │   │   ├── BookCard.tsx
│   │   │   │   ├── LibrarianBar.tsx
│   │   │   │   └── TopBar.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useBookshelf.ts
│   │   │   ├── store/
│   │   │   │   └── bookshelf-store.ts
│   │   │   └── BookshelfPage.tsx      # 页面入口
│   │   │
│   │   ├── reader/                    # 阅读功能
│   │   │   ├── components/
│   │   │   │   ├── EpubViewer.tsx
│   │   │   │   ├── ReaderHeader.tsx
│   │   │   │   └── ModeToggle.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useReader.ts
│   │   │   └── ReaderPage.tsx
│   │   │
│   │   ├── chat/                      # 对话功能
│   │   │   ├── components/
│   │   │   │   ├── ChatInterface.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   └── CitationBadge.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useChat.ts
│   │   │   └── services/
│   │   │       └── persona-generator.ts
│   │   │
│   │   └── persona/                   # 角色管理
│   │       ├── components/
│   │       │   └── PersonaConfigDialog.tsx
│   │       ├── hooks/
│   │       │   └── usePersona.ts
│   │       └── store/
│   │           └── persona-store.ts
│   │
│   ├── shared/                        # 共享代码
│   │   ├── components/                # 通用 UI 组件
│   │   │   └── ui/                    # shadcn/ui 组件目录
│   │   ├── hooks/
│   │   │   └── useIpc.ts             # IPC 通信 hook
│   │   ├── lib/
│   │   │   └── utils.ts              # 工具函数
│   │   └── types/
│   │       └── index.ts              # 全局类型定义 (第五章的接口)
│   │
│   ├── workers/                       # Web Worker
│   │   ├── rag.worker.ts             # RAG 引擎 Worker
│   │   └── rag-types.ts              # Worker 消息类型定义
│   │
│   ├── styles/
│   │   └── globals.css               # TailwindCSS 入口
│   │
│   └── main.tsx                       # React 入口
│
├── public/                            # 静态资源
│   └── models/                        # ML 模型文件 (Transformers.js)
│
├── .env.example                       # 环境变量示例
├── electron-builder.yml               # 打包配置
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── components.json                    # shadcn/ui 配置
└── package.json
```

---

## 第八章：开发路线图与优先级 (Execution Roadmap & Priority)

### 8.1 总览

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
基建         书架         大脑         灵魂         整合
(3天)       (4天)       (5天)       (5天)       (3天)
                                               Total: ~20天
```

### 8.2 Phase 1: 基建 (Infrastructure) — 🏗️ 优先级: P0

**目标**：项目能跑起来，基础架构就位。

| 序号 | 任务                                             | 产出                         | 验收标准                                     |
| ---- | ------------------------------------------------ | ---------------------------- | -------------------------------------------- |
| 1.1  | 初始化 Electron + Vite + React + TypeScript 项目 | 可运行的空白窗口             | `npm run dev` 打开 Electron 窗口           |
| 1.2  | 配置 TailwindCSS + shadcn/ui                     | 样式系统就绪                 | 能渲染 shadcn Button 组件                    |
| 1.3  | 建立 Feature-based 目录结构                      | 第七章定义的目录             | 所有文件夹创建完毕                           |
| 1.4  | 配置 IPC 通信管道                                | preload.ts + ipc-handlers.ts | Renderer 能通过 IPC 调用 Main 函数           |
| 1.5  | 定义全局 TypeScript 类型                         | `shared/types/index.ts`    | 第五章的所有接口写入                         |
| 1.6  | 配置路由                                         | react-router-dom             | `/bookshelf` 和 `/reader/:id` 路由可切换 |
| 1.7  | 初始化 Zustand Store                             | 基础 store 骨架              | Store 能读写，DevTools 可调试                |

**AI Prompt**:

```
基于 Electron v28+, React v18+, TypeScript, Vite 创建项目结构。
配置 TailwindCSS 和 shadcn/ui。
请按照 Feature-based 结构组织目录：features/bookshelf, features/reader, features/chat, features/persona。
配置 electron-vite 或 vite-plugin-electron 进行主进程和渲染进程的统一构建。
设置 preload 脚本的 contextBridge，暴露安全的 IPC API。
```

---

### 8.3 Phase 2: 书架 (The Bookshelf) — 📚 优先级: P0

**目标**：用户能看到书架、导入书籍、通过 MCP 管理文件。

| 序号 | 任务                     | 产出                             | 验收标准                                    |
| ---- | ------------------------ | -------------------------------- | ------------------------------------------- |
| 2.1  | 实现 McpManager 单例     | `electron/main/mcp-manager.ts` | 能通过 Stdio 连接 MCP Filesystem Server     |
| 2.2  | 实现 IPC → MCP 桥接     | IPC handlers for MCP             | 渲染进程能调用 `listFiles` / `readFile` |
| 2.3  | 开发 TopBar 组件         | Logo + 操作按钮                  | UI 渲染正确                                 |
| 2.4  | 开发 BookGrid + BookCard | 书籍网格展示                     | 2:3 卡片、hover 动效                        |
| 2.5  | 实现"挂载书架"流程       | 选择文件夹 → MCP 连接 → 扫描   | 选择目录后自动展示 .epub 文件               |
| 2.6  | 开发 LibrarianBar        | 底部聊天输入框                   | 固定在底部，不随滚动                        |
| 2.7  | 实现点击书籍导航         | 路由跳转到 `/reader/:id`       | 点击卡片进入阅读页                          |

**AI Prompt**:

```
在 electron/main 目录下创建一个 McpManager 类。
使用 @modelcontextprotocol/sdk 通过 StdioClientTransport 启动并连接本地的 npx @modelcontextprotocol/server-filesystem。
暴露 listFiles 和 readFile 方法给 Renderer 进程（通过 IPC）。
McpManager 必须是单例模式，支持 connect/disconnect/reconnect。
```

---

### 8.4 Phase 3: 大脑 (The Brain) — 🧠 优先级: P0

**目标**：本地 RAG 引擎能索引书籍、语义检索。

| 序号 | 任务                  | 产出                     | 验收标准                           |
| ---- | --------------------- | ------------------------ | ---------------------------------- |
| 3.1  | 配置 Web Worker 环境  | Vite Worker 配置         | Worker 能正常启动和通信            |
| 3.2  | 集成 Transformers.js  | 模型加载（单例）         | 首次加载模型，后续复用             |
| 3.3  | 集成 Orama 向量数据库 | 索引创建与查询           | 能存入向量并检索                   |
| 3.4  | 实现 `ingest` 函数  | 完整索引管道             | 输入文本 → 切分 → 向量化 → 存储 |
| 3.5  | 实现 `search` 函数  | 语义检索接口             | 输入查询 → 返回 Top-K 结果 + 分数 |
| 3.6  | 实现 IndexedDB 持久化 | 索引缓存机制             | 关闭重启后秒级加载索引             |
| 3.7  | 实现进度上报          | `ingest:progress` 消息 | UI 能展示索引进度条                |

**AI Prompt**:

```
创建一个 Web Worker `src/workers/rag.worker.ts`。
引入 @xenova/transformers 和 @orama/orama。
实现一个 ingest 函数：接收 chapters 数组，使用 RecursiveCharacterTextSplitter(size:500, overlap:50) 切分，
用 all-MiniLM-L6-v2 生成 384 维向量，存入 Orama。
模型加载必须是单例模式，仅首次调用时加载。
实现 search 函数：接收 query 字符串，返回 top-5 相似片段及 CFI 和分数。
实现 IndexedDB 持久化：索引完成后自动保存，再次打开同一本书时直接加载。
```

---

### 8.5 Phase 4: 灵魂 (The Soul) — 💫 优先级: P1

**目标**：AI 对话、角色生成、沉浸体验。

| 序号 | 任务                       | 产出                                  | 验收标准                         |
| ---- | -------------------------- | ------------------------------------- | -------------------------------- |
| 4.1  | 实现 LLM API Handler       | `electron/main/llm-handler.ts`      | 能调用 DeepSeek API 并流式返回   |
| 4.2  | 实现 API Key 安全存储      | `electron/main/safe-storage.ts`     | Key 加密存储，不暴露给 Renderer  |
| 4.3  | 开发 ChatInterface 组件    | 消息列表 + 气泡                       | ChatGPT 风格，支持 Markdown 渲染 |
| 4.4  | 实现流式打字机效果         | SSE 流式接收 → 逐字显示              | 用户感知实时生成                 |
| 4.5  | 开发 PersonaConfigDialog   | 角色配置弹窗                          | 输入名字 → 一键生成 → 确认保存 |
| 4.6  | 实现 PersonaGenerator 服务 | RAG Search → LLM Summarize → Prompt | 自动生成角色 System Prompt       |
| 4.7  | 实现阅读/对话模式切换      | framer-motion 过渡动画                | 丝滑切换，无闪烁                 |
| 4.8  | 开发 EpubViewer 组件       | react-reader 集成                     | 能渲染 EPUB 并记住进度           |

**AI Prompt**:

```
编写一个 PersonaGenerator 服务 (src/features/chat/services/persona-generator.ts)。
它需要：
1. 调用 RAG Worker 的 search 接口，用角色名 + 多个维度关键词并发查找相关片段
2. 组装一个 Prompt 发送给 LLM API
3. 要求 LLM 返回符合 Persona 接口的 JSON 数据
4. 解析响应并生成完整的 systemPrompt
```

---

### 8.6 Phase 5: 整合 (Integration) — 🔗 优先级: P1

**目标**：串联所有模块，打磨体验。

| 序号 | 任务                   | 产出                              | 验收标准                                           |
| ---- | ---------------------- | --------------------------------- | -------------------------------------------------- |
| 5.1  | 实现引用跳转           | 点击 Citation → 阅读器跳转到 CFI | 对话中的引用可点击，自动切换到阅读模式并滚动到原文 |
| 5.2  | 实现笔记功能           | Chat 调用 MCP write_file          | 用户说"记笔记" → Agent 写入本地 Markdown          |
| 5.3  | Librarian Agent 智能化 | 自然语言 → MCP 工具调用          | "整理书架" → Agent 自动分类移动文件               |
| 5.4  | 设置页面               | API Key 配置、模型选择            | 用户能配置 LLM provider 和 Key                     |
| 5.5  | 错误处理 & Edge Cases  | 全局错误边界                      | 网络断开、模型加载失败、文件不存在等场景           |
| 5.6  | 性能优化               | 懒加载、缓存优化                  | 大书索引不卡顿，对话响应 < 2s                      |
| 5.7  | 打包测试               | electron-builder                  | 能生成可安装的 .dmg / .exe                         |

**AI Prompt**:

```
实现"引用跳转"功能：
当 ChatInterface 中渲染 MessageBubble 时，如果消息包含 citations 数组，
为每个 citation 渲染一个可点击的 CitationBadge 组件。
点击后：
1. 切换 readerMode 为 'read'
2. 调用 EpubViewer 的 goToCfi(citation.cfi) 方法
3. 高亮对应文本片段
使用 framer-motion 实现从 chat 到 read 模式的平滑过渡。
```

---

## 第九章：关键指令集 (Vibe Coding Prompts)

> 以下 Prompt 已预调优，可直接复制发送给 AI 编程助手。

### 9.1 项目初始化

```
你是一个专精 Electron + React + TypeScript 的高级前端工程师。
我们正在构建 "ImmerseAI"，一个 Local-First 的 AI 阅读 Agent 桌面应用。

技术栈约束：
- Electron v28+, React v18+, TypeScript (strict), Vite v5+
- TailwindCSS + shadcn/ui + lucide-react + framer-motion
- Zustand 状态管理
- Feature-based 目录结构

请创建完整的项目脚手架，包括：
1. package.json 依赖
2. Vite 配置（支持 Electron 主进程 + 渲染进程）
3. TailwindCSS 配置
4. TypeScript 配置（strict mode）
5. 目录结构（按 Feature-based 组织）
6. 主进程入口、preload 脚本、React 入口
7. 路由配置（/bookshelf 和 /reader/:id）
```

### 9.2 MCP 集成

```
在 electron/main/mcp-manager.ts 创建 McpManager 类。

要求：
1. 单例模式
2. 使用 @modelcontextprotocol/sdk 的 Client 类
3. 通过 StdioClientTransport 连接
4. connectLocal(path) 方法：spawn `npx @modelcontextprotocol/server-filesystem <path>`
5. 暴露 listFiles(path) 和 readFile(path) 方法
6. 支持 disconnect() 和 reconnect()
7. 错误处理：子进程崩溃时自动重启（最多 3 次）
8. 通过 ipcMain.handle 暴露给渲染进程
```

### 9.3 RAG Worker

```
创建 src/workers/rag.worker.ts。

要求：
1. 引入 @xenova/transformers 的 pipeline 函数
2. 引入 @orama/orama 创建向量数据库
3. 模型加载：单例模式，使用 all-MiniLM-L6-v2 quantized
4. ingest(bookId, chapters)：
   - RecursiveCharacterTextSplitter(500, 50)
   - 批量向量化（batch size: 32）
   - 存入 Orama（schema: text, vector[384], cfi, chapter）
   - 每处理 10% 发送 progress 消息
   - 完成后持久化到 IndexedDB
5. search(bookId, query, topK=5)：
   - 向量化 query
   - Orama 向量搜索
   - 返回 { text, cfi, chapter, score }[]
6. 启动时检查 IndexedDB 缓存
```

### 9.4 UI 生成

```
你是精通 React + TailwindCSS + shadcn/ui 的前端专家。
设计风格：Notion 极简主义。
色板：slate-900 文字, white/slate-50 背景, slate-200 边框。
严格使用 shadcn/ui 组件 + lucide-react 图标。

请生成 [具体页面/组件名] 的完整代码。
```

---

## 第十章：安全与约束 (Security & Constraints)

### 10.1 安全规则

| 规则             | 说明                                                           |
| ---------------- | -------------------------------------------------------------- |
| API Key 存储     | 必须使用 `Electron safeStorage` 加密，**禁止**明文存储 |
| contextIsolation | 必须为 `true`，渲染进程无法直接访问 Node.js                  |
| nodeIntegration  | 必须为 `false`                                               |
| IPC 白名单       | preload 仅暴露预定义的 channel，禁止通配符                     |
| MCP 沙箱         | MCP Server 仅能访问用户**显式选择**的目录                |
| 出站流量         | 仅允许 LLM API 端点，禁止其他网络请求                          |

### 10.2 性能约束

| 指标                 | 目标值                       |
| -------------------- | ---------------------------- |
| 首次启动             | < 3 秒                       |
| 书架加载（100 本书） | < 1 秒                       |
| 已索引书籍重新打开   | < 500ms（从 IndexedDB 加载） |
| 语义检索响应         | < 200ms                      |
| LLM 首 Token 延迟    | < 2 秒（取决于 API）         |
| UI 帧率              | 保持 60fps，无卡顿           |

### 10.3 代码质量约束

```typescript
// ✅ 允许
const result: SearchResult[] = await search(query);

// ❌ 禁止
const result: any = await search(query);       // NO any
let result = await search(query);               // NO implicit type
```

- **TypeScript strict mode**：开启所有严格检查
- **NO `any`**：使用 `unknown` 并类型守卫
- **NO `console.log` in production**：使用统一的 Logger
- **所有异步操作必须有错误处理**：try-catch 或 `.catch()`

---

## 附录 A：术语表

| 术语      | 全称                           | 定义                                  |
| --------- | ------------------------------ | ------------------------------------- |
| MCP       | Model Context Protocol         | Anthropic 开发的 Agent 工具调用协议   |
| RAG       | Retrieval-Augmented Generation | 检索增强生成，用外部知识补充 LLM      |
| CFI       | Canonical Fragment Identifier  | EPUB 内容定位标准，精确到段落/句子    |
| Embedding | 向量嵌入                       | 将文本转换为高维数值向量的过程        |
| Orama     | -                              | 高性能纯 JavaScript 全文/向量搜索引擎 |
| Sidecar   | 边车模式                       | 子进程伴随主进程运行的架构模式        |
| SSE       | Server-Sent Events             | 服务器推送事件，用于 LLM 流式响应     |

---

## 附录 B：修订日志

| 版本 | 日期       | 修改内容                   |
| ---- | ---------- | -------------------------- |
| v1.0 | 2025-01-XX | 初始版本，建立完整宪法框架 |

---

**⚔️ 这份宪法是 ImmerseAI 的最高法律。所有代码必须在此框架内生成。任何 AI 助手在生成代码前，请先确认是否符合本文档的约束。**
