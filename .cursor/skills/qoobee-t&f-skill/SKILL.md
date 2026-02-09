---
name: qoobee-t&f-skill
description: "Test & Fix skill for ImmerseAI. Supports automated testing (AT-01~AT-14), manual test report fixing (HT-01~HT-10), and CR(Code Review) report output. Trigger with: 自动化测试, 自动测试, auto test, 人工测试, manual test, 测试报告, test report, 运行测试, run tests, CR, code review, 代码审查."
license: MIT
compatibility: Requires ImmerseAI project with TypeScript, Electron, and electron-vite configured.
metadata:
  author: qoobee
  version: "1.0"
  project: ImmerseAI
---

# QooBee Test & Fix Skill

自动化测试执行 + 人工测试报告修复的双模式 Agent Skill。

**数据源**: `docs/test-classification.md` — 包含所有自动化测试项 (AT-01~AT-14) 和人工测试表格 (HT-01~HT-10) 的完整定义。

---

## Step 1: Mode Routing (模式路由)

**根据用户输入自动分流到对应模式。**

### Case A: 自动化测试模式

If the user's message contains any of: `自动化测试`, `自动测试`, `auto test`, `运行测试`, `run tests`, `AT-`

→ Go to **Step 2: Automated Test Engine**

### Case B: 人工报告修复模式

If the user's message contains any of: `人工测试`, `manual test`, `测试报告`, `test report`, `修复报告`

AND the message includes test report content (Markdown tables with status columns, or ❌/FAIL markers)

→ Go to **Step 3: Manual Report Fix Engine**

### Case C: 模糊输入

If the user's message is ambiguous (e.g., just `测试`, `test`, `检查`):

Use the **ask_questions** tool to let user choose:

```
Question: "你想执行哪种测试模式？"
Options:
  - "🤖 自动化测试 — Agent 自动执行代码审计 (AT-01~AT-14) 并修复问题"
  - "📋 人工测试修复 — 提交人工测试报告，Agent 修复失败项"
```

Then route to the selected mode.

---

## Step 2: Automated Test Engine (自动化测试执行引擎)

**Agent 自主执行代码检查，产出 PASS/FAIL，FAIL 时自动修复并重验。**

### 2.1 Initialization

1. Read `docs/test-classification.md` to load the full test definitions
2. Use **manage_todo_list** to create a tracking list for all AT items to execute
3. If user specified a specific test (e.g., "运行 AT-06"), only execute that item
4. Otherwise, execute AT-01 through AT-14 in order

### 2.2 Per-Test Execution Loop

For each AT-XX test item, execute the following cycle:

```
┌─────────────────────────────────────────┐
│ AT-XX: <Test Name>                      │
│                                          │
│  1. Execute 执行步骤 (read files, run   │
│     commands, grep search, etc.)         │
│                                          │
│  2. Compare against 预期结果             │
│     ├── Match → PASS ✅                 │
│     └── Mismatch → FAIL ❌              │
│                                          │
│  3. If FAIL:                             │
│     a. Follow 结果处理 fix strategy      │
│     b. Implement code changes            │
│     c. Re-run this test to verify        │
│     d. If still FAIL, retry once more    │
│     e. If FAIL after 2 fix attempts,     │
│        log as UNRESOLVED and continue    │
│                                          │
│  4. Update todo list, move to next test  │
└─────────────────────────────────────────┘
```

### 2.3 Test Item Definitions

Each test item below defines: what to check, what to expect, and how to fix if failing. The Agent MUST follow these steps precisely.

---

#### AT-01: TypeScript 编译检查

**Execute:**
1. Run `npx electron-vite build` in terminal
2. Capture output, count errors

**Expect:** Zero compilation errors (0 errors)

**On FAIL:**
- Parse error messages, group by file
- Fix each type error:
  - `any` type → replace with correct specific type
  - Missing type declaration → create .d.ts file
  - Import path error → fix path alias
  - Interface mismatch → align definition with usage
- Re-run build to verify

---

#### AT-02: 依赖完整性检查

**Execute:**
1. Check if node_modules exists, run `npm install` if not
2. Run `npm ls --depth=0`
3. Grep all .ts/.tsx files for third-party imports
4. Compare against package.json dependencies

**Expect:**
- No MISSING or INVALID in npm ls
- Every imported package exists in package.json

**On FAIL:**
- Missing dependency → run `npm install <package>`
- Ghost dependency → log but don't remove
- Version conflict → log details

---

#### AT-03: Zustand Store 结构一致性

**Execute:**
1. Read `src/shared/types/index.ts` — extract ImmerseStore interface
2. Read `src/shared/store/index.ts` — extract actual implementation
3. Compare field-by-field: state fields have initial values, actions have implementations
4. Check persist middleware: books/personas/currentSession persisted; indexingProgress/isGenerating NOT persisted

**Expect:** All fields match, persist config correct

**On FAIL:**
- Missing field → add to store implementation
- Persist config wrong → fix partialize function
- Type mismatch → align types

---

#### AT-04: IPC Channel 一致性

**Execute:**
1. Read `electron/preload/index.ts` — extract all `ipcRenderer.invoke('channel')` channels
2. Read `electron/main/ipc-handlers.ts` — extract all `ipcMain.handle('channel')` channels
3. Read `electron/main/index.ts` — confirm `registerIpcHandlers()` is called
4. Compare channel lists

**Expect:** 1:1 match between preload and main

**On FAIL:**
- Preload has channel but main doesn't → add handler in ipc-handlers.ts
- Main has channel but preload doesn't → add to preload
- Signature mismatch → align both sides

---

#### AT-05: 路由配置完整性

**Execute:**
1. Read `src/app/router.tsx`
2. Check each route's component file exists and is non-empty
3. Verify routes: `/` → redirect to `/bookshelf`, `/bookshelf`, `/reader/:id`

**Expect:** All core routes configured, components exist

**On FAIL:**
- Missing route → add to router.tsx
- Component missing → create minimal page skeleton
- Missing 404 → add `*` catch-all route

---

#### AT-06: IPC→MCP 真实桥接 (关键缺陷)

**Execute:**
1. Read `electron/main/ipc-handlers.ts`
2. Check if McpManager is imported and called for mcp:* handlers
3. Check if handlers return hardcoded mock data

**Expect:** mcp:* handlers call McpManager.getInstance() methods, no mock data

**On FAIL:**
1. Import McpManager from './mcp-manager'
2. Replace mcp:list-files with `McpManager.getInstance().listFiles(path)`
3. Replace mcp:read-file with `McpManager.getInstance().readFile(path)`
4. Replace mcp:write-file with `McpManager.getInstance().writeFile(path, content)`
5. Replace mcp:move-file with `McpManager.getInstance().moveFile(source, destination)`
6. Add mcp:connect and mcp:disconnect handlers
7. Add try-catch with meaningful error messages
8. Re-run AT-01 to verify compilation

---

#### AT-07: BookCard 路由跳转 (关键缺陷)

**Execute:**
1. Read `src/features/bookshelf/components/BookCard.tsx`
2. Check if onClick triggers `useNavigate` to `/reader/:id`
3. Check BookGrid.tsx and BookshelfPage.tsx pass click handlers

**Expect:** BookCard click → `navigate(\`/reader/${book.id}\`)` + `selectBook(book.id)`

**On FAIL:**
1. In BookGrid, add onBookClick callback that navigates and selects
2. Pass onClick to each BookCard
3. Ensure BookshelfPage uses store.books not MOCK_BOOKS
4. Verify compilation

---

#### AT-08: 挂载书架流程 (关键缺陷)

**Execute:**
1. Check TopBar.tsx button onClick handlers
2. Check if BookshelfPage uses real data (not MOCK_BOOKS)
3. Check if `window.electronAPI.app.selectDirectory()` is called anywhere
4. Check if MCP listFiles result writes to Zustand store

**Expect:** Complete mount flow: TopBar button → selectDirectory → MCP connect → listFiles → setBooks → BookGrid renders

**On FAIL:**
1. Create `src/features/bookshelf/hooks/useBookshelf.ts` with mountBookshelf()
2. TopBar Import button calls mountBookshelf()
3. BookshelfPage reads from store.books
4. Handle empty/loading states
5. Verify compilation

---

#### AT-09: Worker 消息协议完整性

**Execute:**
1. Read `src/workers/rag-types.ts`
2. Read `src/workers/rag.worker.ts` onmessage handler
3. Verify WorkerMessage includes: ingest / search / status
4. Verify WorkerResponse includes: ingest:progress / ingest:complete / search:result / status:result / error
5. Read `src/shared/hooks/useRagWorker.ts` — verify hook wraps all message types

**Expect:** All message types defined and handled

**On FAIL:** Add missing message types/handlers

---

#### AT-10: Persona System Prompt 模板

**Execute:**
1. Read `src/features/chat/services/persona-generator.ts`
2. Find systemPrompt generation logic
3. Compare with constitution template (section 4.3.4):
   - Contains {role_name}
   - Contains 【身份背景】【性格特征】【说话风格】【当前上下文】
   - Contains 5 行为准则 (rule 4: "绝对不要暴露你是AI")

**Expect:** Template structure matches constitution

**On FAIL:** Fix template to match constitution exactly

---

#### AT-11: 安全配置检查

**Execute:**
1. Read `electron/main/index.ts` BrowserWindow config
2. Verify: nodeIntegration=false, contextIsolation=true
3. Grep `src/` for `apiKey` direct references
4. Check llm-handler.ts reads Key from safeStorage
5. Check preload doesn't expose Node.js APIs

**Expect:** Security config compliant

**On FAIL:**
- nodeIntegration not false → fix immediately
- API Key leaked to renderer → remove and use IPC

---

#### AT-12: 设置页面存在性 (关键缺陷)

**Execute:**
1. Check if `src/features/settings/` directory exists
2. Check if router.tsx has `/settings` route
3. Check if TopBar settings button navigates

**Expect:** SettingsPage.tsx exists, /settings route registered, TopBar links to it

**On FAIL:**
1. Create `src/features/settings/SettingsPage.tsx` with:
   - LLM Provider select (deepseek/kimi/moonshot/openai/custom)
   - API Key input (via safeStorage IPC)
   - Base URL, Model inputs
   - Temperature slider (0.0-1.0), MaxTokens slider (256-8192)
   - Bookshelf path display + change directory button
   - Test connection button
2. Register /settings route in router.tsx
3. TopBar settings button → navigate('/settings')
4. Verify compilation

---

#### AT-13: shadcn/ui 组件完整性

**Execute:**
1. List files in `src/shared/components/ui/`
2. Grep all `from '@/shared/components/ui/'` imports in `src/`
3. Check for imported but missing component files

**Expect:** All imported UI components exist as files

**On FAIL:** Create missing component files (manually or via shadcn CLI pattern)

---

#### AT-14: electron.d.ts 类型声明

**Execute:**
1. Check if `src/shared/types/electron.d.ts` exists
2. Verify ElectronAPI interface matches preload exposed API
3. Check Window.electronAPI global type declaration

**Expect:** electron.d.ts exists, types match preload

**On FAIL:**
1. Create/fix electron.d.ts with ElectronAPI interface
2. Add Window interface extension
3. Ensure tsconfig.json includes the file

---

### 2.4 Compilation Gate (编译门禁)

After ALL automated tests complete (or after any batch of fixes):

1. Run `npx electron-vite build`
2. If errors exist, fix them
3. Repeat until clean build

### 2.5 Output: Automated Test Report

After all tests complete, produce this summary:

```
## 🤖 自动化测试报告

**执行日期**: YYYY-MM-DD
**测试总数**: 14
**通过**: X | **失败并修复**: Y | **未解决**: Z

### 详细结果
| 编号 | 测试项 | 结果 | 修复内容 |
|------|--------|------|----------|
| AT-01 | TypeScript 编译 | ✅ PASS | — |
| AT-06 | IPC→MCP 桥接 | 🔧 FIXED | 替换 mock 为真实 McpManager 调用 |
| ... | ... | ... | ... |

### 修复涉及文件
- electron/main/ipc-handlers.ts
- src/features/bookshelf/components/BookCard.tsx
- ...

### 编译验证
✅ `electron-vite build` 通过，0 错误
```

### 2.6 CR: Code Review Report（代码审查报告）

在自动化测试执行完毕（以及必要的自动修复完成）后，Agent MUST 额外输出一份 **CR（Code Review）报告**，用于给人类快速审阅本次改动的风险点与建议。

**输出格式（必须包含三个等级）：**

```
## 🧾 CR (Code Review) 报告

### CRITICAL（必须修）
- <问题> — <影响> — <建议动作（指向文件/函数）>

### WARNING（建议修）
- <问题> — <影响> — <建议动作>

### SUGGESTION（可选优化）
- <问题> — <收益> — <建议动作>
```

**CR 覆盖范围（最低要求）：**
- 变更是否符合 `docs/test-classification.md` 的预期与修复策略
- Electron 安全配置（nodeIntegration/contextIsolation/preload 暴露面）
- IPC channel 与类型声明一致性（preload ↔ main ↔ `electron.d.ts`）
- 打包/运行时差异（如 `file://` 路由、asar/unpacked、子进程启动路径）

---

## Step 3: Manual Report Fix Engine (人工报告解析修复引擎)

**接收人工测试报告，解析失败项，逐个修复。**

### 3.1 Report Parsing

1. Receive the user's message containing test report content
2. Parse Markdown tables looking for status columns
3. Extract FAILED items — recognize these markers as failures:
   - ❌, FAIL, 失败, ✗, ×, NO, NG, 不通过
4. For each failed item, extract: test number, test name, expected result, actual result
5. If no failures found, report "所有测试项通过，无需修复"

### 3.2 Fix Execution

1. Use **manage_todo_list** to create tracking for all failed items
2. For each failed item:
   a. Analyze the failure: compare expected vs actual result
   b. Identify the likely cause (read relevant source files)
   c. Implement the code fix
   d. Mark todo as complete
3. After all fixes, run compilation gate

### 3.3 Context-Aware Fixing

When analyzing failures, use this mapping to identify relevant code:

| HT Group | Relevant Code |
|-----------|---------------|
| HT-01 启动外观 | `electron/main/index.ts`, `src/styles/globals.css`, `tailwind.config.ts` |
| HT-02 书架UI | `src/features/bookshelf/**` |
| HT-03 目录挂载 | `electron/main/mcp-manager.ts`, `electron/main/ipc-handlers.ts`, `src/features/bookshelf/hooks/` |
| HT-04 EPUB阅读器 | `src/features/reader/**` |
| HT-05 模式切换 | `src/features/reader/components/ModeToggle.tsx`, `src/features/reader/ReaderPage.tsx` |
| HT-06 角色配置 | `src/features/persona/**` |
| HT-07 AI对话 | `src/features/chat/**`, `electron/main/llm-handler.ts` |
| HT-08 RAG索引 | `src/workers/rag.worker.ts`, `src/shared/hooks/useRagWorker.ts` |
| HT-09 设置页面 | `src/features/settings/**`, `src/app/router.tsx` |
| HT-10 端到端 | Cross-cutting, analyze per sub-item |

### 3.4 Output: Manual Fix Report

After all fixes complete, produce:

```
## 📋 人工测试修复报告

**报告来源**: HT-XX (用户提交)
**失败项数**: N
**已修复**: M
**未能修复**: K

### 修复明细
| # | 测试项 | 问题原因 | 修复方案 | 状态 |
|---|--------|----------|----------|------|
| X.Y | <名称> | <原因分析> | <修改内容> | ✅ 已修复 |
| ... | ... | ... | ... | ... |

### 变更文件
- path/to/file1.tsx — <变更摘要>
- path/to/file2.ts — <变更摘要>

### 编译验证
✅ `electron-vite build` 通过，0 错误

### ⚠️ 需要人工复测的项
- <如有修复后仍需人工确认的项目，列出>
```

---

## Guardrails

- **NEVER skip the compilation gate** — every fix session MUST end with a clean build
- **NEVER modify test definitions** in `docs/test-classification.md` during test execution
- **ALWAYS use manage_todo_list** to track progress through multiple test/fix items
- **If a fix would require architectural changes**, pause and report instead of forcing a fix
- **Max 2 fix attempts per AT item** — after 2 failures, log as UNRESOLVED and move on
- **Preserve existing passing behavior** — fixes must not break things that already work
