# Agent 记忆与上下文管理方案

> 项目路径: `C:\Users\Qoobeewang\Desktop\agents`
> 参考来源: openclaw-main, edict-main

---

## 一、总体架构对比

| 维度 | OpenClaw | Edict |
|------|----------|-------|
| **记忆形式** | 工具 + 文件 + 向量检索 | 看板任务 + 会话消息 |
| **上下文来源** | System Prompt 注入 + Memory Tools | 任务状态 + Event Bus |
| **上下文窗口** | 动态计算 + Compaction 压缩 | 依赖 OpenClaw Session |
| **持久化** | Markdown 文件 + SQLite + LanceDB | PostgreSQL + JSONB |

---

## 二、OpenClaw 记忆系统详解

### 2.1 核心文件索引

```
openclaw-main/
├── src/
│   ├── agents/
│   │   ├── memory-search.ts         # Memory Search 配置解析
│   │   ├── context-cache.ts         # Token 缓存
│   │   ├── context-window-guard.ts  # 上下文窗口守卫
│   │   └── system-prompt.ts         # System Prompt 构建（含 Memory Section）
│   ├── plugins/
│   │   ├── memory-state.ts          # 插件状态注册
│   │   ├── memory-runtime.ts        # 运行时集成
│   │   └── memory-embedding-providers.ts  # Embedding Provider 注册
│   ├── auto-reply/reply/
│   │   ├── memory-flush.ts          # 压缩前内存 Flush 逻辑
│   │   └── post-compaction-context.ts  # 压缩后上下文注入
│   └── sessions/                    # Session 管理
├── extensions/
│   ├── memory-core/                 # 内置文件记忆插件
│   │   └── src/
│   │       ├── prompt-section.ts   # Memory Prompt Section Builder
│   │       ├── flush-plan.ts       # Flush 计划生成
│   │       └── memory/manager.ts   # MemoryIndexManager (混合搜索)
│   └── memory-lancedb/             # LanceDB 向量记忆插件
└── packages/
    └── memory-host-sdk/            # 记忆插件 SDK
        └── src/host/
            ├── memory-schema.ts    # SQLite Schema
            └── types.ts            # MemorySearchManager 接口
```

### 2.2 三层记忆架构

```
┌─────────────────────────────────────────────────────────┐
│                   System Prompt                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │            Memory Section (注入)                  │    │
│  │  "Before answering anything about prior work,   │    │
│  │   decisions, dates, people, preferences:        │    │
│  │   run memory_search + memory_get"               │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Memory Tools (Agent 调用)                   │
│                                                          │
│  memory_search(query) → MemorySearchResult[]             │
│  memory_get(relPath, from?, lines?) → file content      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Memory Backend (可插拔)                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ memory-core  │  │ memory-lance │  │   Custom     │  │
│  │ (SQLite+FTS) │  │    (DB)      │  │   Plugin     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Memory Core 文件结构

```
memory/
├── YYYY-MM-DD.md           # 每日记忆文件 (Append-only)
├── YYYY-MM-DD-slug.md      # 命名记忆文件
└── MEMORY.md               # 长期记忆 (精选)
```

### 2.4 搜索配置 (MemorySearchConfig)

```typescript
// src/config/types.tools.ts
{
  sources: ["memory", "sessions"],  // 搜索范围
  provider: "auto",                 // auto/OpenAI/Gemini/Ollama/本地
  chunking: { tokens: 400, overlap: 80 },
  sync: {
    onSessionStart: true,           // Session 启动时同步
    onSearch: true,                // 搜索前同步
    watch: true,                   // 文件监控
    sessions: {
      deltaBytes: 50_000,          // 超过阈值触发增量索引
      deltaMessages: 200,
    }
  },
  query: {
    maxResults: 6,
    minScore: 0.35,
    hybrid: {
      enabled: true,
      vectorWeight: 0.7,           // 向量权重
      textWeight: 0.3,             // FTS/BM25 权重
      mmr: { enabled: false },      // 最大边际相关性去重
      temporalDecay: { enabled: false, halfLifeDays: 30 }
    }
  }
}
```

### 2.5 SQLite Schema (memory-host-sdk)

```sql
-- packages/memory-host-sdk/src/host/memory-schema.ts
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'memory',
  hash TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL
);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'memory',
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  hash TEXT NOT NULL,
  model TEXT NOT NULL,           -- Embedding 模型
  text TEXT NOT NULL,
  embedding TEXT NOT NULL,       -- 向量 (Base64 或 JSON)
  updated_at INTEGER NOT NULL
);

-- 全文搜索
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text, content=chunks, content_rowid=rowid
);
```

### 2.6 混合搜索实现 (Hybrid Search)

```typescript
// extensions/memory-core/src/memory/manager.ts
async search(query: string, opts?): Promise<MemorySearchResult[]> {
  // 1. 无 Provider → 纯 FTS 模式 (关键词提取)
  // 2. 有 Provider → 混合搜索
  //    - 向量相似度 Top-K
  //    - BM25 关键词 Top-K
  //    - RRF 融合 (Reciprocal Rank Fusion)
  // 3. MMR 去重 (可选)
  // 4. 时间衰减 (可选)
}
```

### 2.7 上下文窗口管理

**Token 计算与守卫** (`context-window-guard.ts`):
```typescript
export const CONTEXT_WINDOW_HARD_MIN_TOKENS = 16_000;
export const CONTEXT_WINDOW_WARN_BELOW_TOKENS = 32_000;

interface ContextWindowInfo {
  totalTokens: number;
  contextWindow: number;
  availableTokens: number;
  shouldWarn: boolean;   // < 32k
  shouldBlock: boolean;  // < 16k
}
```

### 2.8 Compaction (压缩) 机制

当上下文即将溢出时，触发 Compaction：

```
┌──────────────────────────────────────────────┐
│         Session Transcript (JSONL)            │
│  [{"role":"user","content":"..."},           │
│   {"role":"assistant","content":"..."},      │
│   {"role":"tool","content":"result..."}]    │
└────────────────────┬───────────────────────┘
                     │ compaction 触发
                     ▼
┌──────────────────────────────────────────────┐
│     压缩摘要 (Summarization)                  │
│  "用户讨论了 X 功能，决定采用 Y 方案..."         │
└──────────────────────────────────────────────┘
```

**压缩配置** (`types.agent-defaults.ts`):
```typescript
{
  mode: "summarize",
  reserveTokensFloor: 20000,
  recentTurnsPreserve: 3,       // 保留最近 N 轮
  postCompactionSections: ["AGENTS.md Red Lines"],  // 压缩后重新注入
  memoryFlush: {
    enabled: true,
    softThresholdTokens: 4000,
  }
}
```

### 2.9 Memory Flush (预压缩)

在 Compaction 之前，自动执行一个静默回合，将上下文重要信息写入 `memory/YYYY-MM-DD.md`：

```typescript
// extensions/memory-core/src/flush-plan.ts
{
  softThresholdTokens: 4000,      // 触发 Flush 的软阈值
  forceFlushTranscriptBytes: 2 * 1024 * 1024,  // 2MB 强制 Flush
  reserveTokensFloor: 20000,
  relativePath: "memory/YYYY-MM-DD.md"
}
```

### 2.10 上下文裁剪 (Context Pruning)

```typescript
// src/agents/pi-hooks/context-pruning/pruner.ts
{
  mode: "cache-ttl",
  ttlMs: 5 * 60 * 1000,
  keepLastAssistants: 3,
  softTrimRatio: 0.3,    // 30% 上下文窗口时，软裁剪
  hardClearRatio: 0.5,   // 50% 上下文窗口时，硬清空
  softTrim: {
    maxChars: 4_000,
    headChars: 1_500,    // 保留前 N 字符
    tailChars: 1_500,    // 保留后 N 字符
  },
  hardClear: {
    enabled: true,
    placeholder: "[Old tool result content cleared]"
  }
}
```

---

## 三、Edict 记忆系统

### 3.1 核心文件索引

```
edict-main/
├── agents/                    # 12 个 Agent 角色定义
│   ├── taizi/SOUL.md        # 角色定义
│   ├── zhongshu/SOUL.md
│   └── ...
├── edict/backend/
│   ├── app/models/          # Task, Event 数据模型
│   ├── app/services/        # 事件总线、任务服务
│   └── app/workers/         # Orchestrator, Dispatch workers
├── scripts/
│   └── kanban_update.py     # 任务状态 CLI
└── agents.json              # Agent 权限配置
```

### 3.2 上下文来源

Edict 的上下文不来自传统意义上的"记忆"，而是来自**多层架构**：

```
用户消息
    │
    ▼
太子 (Taizi) ──── 接收消息，判断类型
    │
    ▼
中书省 (Zhongshu) ─── 制定执行计划 (写入 kanban)
    │
    ▼
门下省 (Menxia) ─── 审核 (可驳回)
    │
    ▼
尚书省 (Shangshu) ─── 调度给六部
    │
    ▼
六部执行 ──── 结果写入看板 + Session
```

### 3.3 会话消息类型

```typescript
// Event 主题
task.created, task.planning, task.review.request, task.review.result
task.dispatch, agent.thoughts, agent.todo.update, task.status, heartbeat

// 事件结构
{
  event_id: "uuid",
  trace_id: "task-uuid",
  timestamp: "ISO8601",
  topic: "agent.thoughts",
  event_type: "thought.append",
  producer: "planning-agent:v1",
  payload: { content: "思考内容" },
  meta: { priority: "normal", model: "gpt-5-thinking" }
}
```

### 3.4 任务状态存储

```python
# kanban_update.py - 任务数据
{
  "task_id": "JJC-20260329-001",
  "title": "添加书籍到书架",
  "status": "Doing",           # Pending/Taizi/Zhongshu/Menxia/Assigned/Doing/Review/Done
  "department": "hubu",         # 户部
  "assignee": "agent:hubu",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "flow_log": [                # 流程日志
    {"from": "zhongshu", "to": "menxia", "note": "📋 提交审核"},
    {"from": "menxia", "to": "shangshu", "note": "✅ 审核通过"},
  ],
  "result": "...",             # 完成结果
  "summary": "..."             # 摘要
}
```

### 3.5 OpenClaw Session 的使用

Edict Agent 通过 OpenClaw Session 进行对话：

```json
// agents.json 配置
{
  "id": "taizi",
  "workspace": "C:\\Users\\<USER>\\.openclaw\\workspace-taizi",
  "agentDir": "C:\\Users\\<USER>\\.openclaw\\agents\\taizi\\agent",
  "subagents": { "allowAgents": ["zhongshu"] }
}
```

**Session 持久化**: `~/.openclaw/sessions/<session-key>.jsonl`
- 每条消息包含 `role`, `content`, `tool_calls`, `tool_results`
- 可配置向量索引 (`memorySearch.sources: ["memory", "sessions"]`)

### 3.6 工具调用上下文传递

Agent 之间通过 `sessions_send` 传递上下文：

```python
# Edict 中的调用方式
openclaw.sessions_send(
  session="zhongshu:main",
  message={
    "role": "user",
    "content": "任务: {task_id}\n用户需求: {user_request}",
    "context": {
      "task_id": "JJC-20260329-001",
      "source": "taizi",
      "priority": "normal"
    }
  }
)
```

---

## 四、方案对比与借鉴

### 4.1 记忆模式对比

| 方案 | OpenClaw | Edict | 简化方案 |
|------|----------|-------|----------|
| **短期记忆** | Session JSONL + Token 计数 | 看板任务状态 | 对话历史数组 |
| **长期记忆** | Markdown 文件 + 向量检索 | PostgreSQL 任务记录 | SQLite / JSON 文件 |
| **上下文注入** | System Prompt 动态拼接 | Agent 间消息传递 | System Prompt |
| **压缩机制** | Compaction + Memory Flush | 任务完成后归档 | Token 窗口阈值触发 |

### 4.2 简化方案设计 (书架 Agent)

```
┌──────────────────────────────────────────────┐
│              System Prompt                    │
│  - 角色设定                                   │
│  - 可用工具列表                                │
│  - Memory Section (注入)                      │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              Memory Tools                      │
│  bookshelf_search(query)                      │
│  bookshelf_add(title, author, isbn)           │
│  notion_sync(book_id)                         │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              Storage (SQLite)                 │
│                                               │
│  books: id, title, author, isbn, added_at,    │
│         notion_page_id, status                │
│                                               │
│  memory: id, content, embedding, created_at    │
│  sessions: id, messages (JSON), created_at    │
└──────────────────────────────────────────────┘
```

### 4.3 关键借鉴点

#### 借鉴 1: 混合搜索 (OpenClaw memory-core)

```typescript
// 你的简化方案可以用 SQLite FTS5 全文搜索
// 不需要向量 → 降低复杂度
CREATE VIRTUAL TABLE books_fts USING fts5(
  title, author, content=books
);
```

#### 借鉴 2: 上下文窗口守卫

```python
CONTEXT_WINDOW_HARD_MIN = 16000
CONTEXT_WINDOW_WARN = 32000

def check_context_window(messages, model):
    total_tokens = count_tokens(messages)
    context_window = get_model_context_window(model)
    available = context_window - total_tokens

    if available < CONTEXT_WINDOW_HARD_MIN:
        raise Exception("Context window exhausted")
    elif available < CONTEXT_WINDOW_WARN:
        # 触发压缩或提示
        pass
```

#### 借鉴 3: 工具调用循环

```python
async def agent_loop(messages: list[dict]) -> str:
    while True:
        response = await llm.chat(
            model=MODEL,
            messages=messages,
            tools=TOOL_SCHEMAS,
        )

        if not response.tool_calls:
            return response.content

        for call in response.tool_calls:
            result = await execute_tool(call.name, call.args)
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": result,
            })
```

#### 借鉴 4: 记忆文件分区

```
memory/
├── 2026-03-29.md    # 每日记忆
├── 2026-03-28.md
└── books-index.md   # 书籍索引快照
```

#### 借鉴 5: 向量搜索简化

如果只用 Notion 作为外部知识库，不需要本地向量搜索：

```python
# 方案 A: 纯关键词搜索
results = notion.search(query)  # Notion API 本身支持

# 方案 B: SQLite FTS
cursor.execute("SELECT * FROM books WHERE title MATCH ?", (query,))
```

---

## 五、总结

| 层级 | OpenClaw 实现 | 简化方案 |
|------|--------------|----------|
| **记忆存储** | Markdown + SQLite/LanceDB | SQLite |
| **上下文注入** | System Prompt Builder | 直接拼接 |
| **搜索** | Hybrid (向量 + BM25) | SQLite FTS / Notion API |
| **压缩** | Compaction + Memory Flush | Token 阈值触发截断 |
| **多轮对话** | Session JSONL 管理 | messages 数组 |

**核心原则**:
1. **不要过早优化** — 先用 JSON 文件存储，成功后再迁移 SQLite
2. **工具调用循环是核心** — 实现好 `while tool_calls: execute` 就够了
3. **上下文窗口是硬约束** — 必须管理，否则 LLM 会崩溃
4. **记忆按需检索** — 不需要主动记住所有东西，查询时再找
