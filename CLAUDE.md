# ImmerseAI - Agent 开发指南

## 项目概述

**ImmerseAI** 是一款 Local-First 的沉浸式阅读与角色扮演 Agent 桌面应用。通过 MCP 连接本地书库，利用端侧 RAG 理解书籍内容，允许用户通过 LLM 创建"书中角色"进行跨时空对话。

## 索引

| 章节 | 内容 | 何时阅读 |
|------|------|---------|
| [核心约束](#核心约束) | 三大宪法原则 | 每次决策前 |
| [禁止使用](#禁止使用) | 技术选型黑名单 | 引入依赖时 |
| [项目结构](#项目结构) | 目录树 + 文件定位 | 探索代码时 |
| [TDD 规范](#tdd-规范) | 红绿黑循环 + 反作弊规则 | 写代码时 |
| [版本与发布](#版本与发布) | master/dev 策略 + 发布流程 | 发版时 |
| [测试隔离](#测试隔离) | 测试代码隔离 + 不耦合业务 | 写测试时 |
| [Git 规范](#git-规范) | 分支策略 + 提交格式 | 提交代码时 |
| [知识索引](#知识索引) | 资料优先级表 | 查资料时 |
| [资料放置](#资料放置) | 文件归位规则 | 写文档时 |

---

## 核心约束

| 编号 | 名称 | 定义 |
|------|------|------|
| **P-1** | 数据主权 | 书籍文件与向量索引完全本地化，零隐私泄露 |
| **P-2** | UI 零阻塞 | 计算密集型操作必须在 Web Worker 中执行 |
| **P-3** | Agentic 能力 | Agent 必须具备文件系统操作等副作用能力 |

---

## 禁止使用

```
Redux / MobX         → Zustand
Next.js / Nuxt       → Electron 桌面应用
Prisma / TypeORM     → IndexedDB + Orama
axios                → fetch 或 openai SDK
moment.js            → date-fns
lodash (整体)        → tree-shaking 单函数
Tailwind @apply      → 少用
CSS Modules          → Tailwind
```

---

## 项目结构

```
ImmerseAI/
├── electron/
│   ├── main/
│   │   ├── index.ts         # 主进程入口、窗口管理
│   │   ├── ipc-handlers.ts  # IPC 通道路由
│   │   ├── mcp-manager.ts   # MCP 客户端（Stdio）
│   │   ├── rag-handler.ts   # RAG 管道
│   │   ├── llm-handler.ts   # LLM 流式调用
│   │   └── safe-storage.ts  # 加密存储
│   └── preload/
│       └── index.ts         # contextBridge API
├── src/
│   ├── app/                 # 入口 + 路由
│   ├── features/            # 功能模块
│   │   ├── bookshelf/
│   │   ├── chat/
│   │   ├── persona/
│   │   ├── reader/
│   │   └── settings/
│   └── shared/              # 类型、Store、组件
├── tests/                   # 测试代码（隔离目录，与业务分离）
├── docs/                    # 文档（见知识索引）
├── test_book/               # 调试记录
├── openspec/                # OpenSpec 变更
└── _BMAD/                  # BMAD 工作流
```

**关键文件速查：**

| 用途 | 文件 |
|------|------|
| IPC 通道定义 | `electron/main/ipc-handlers.ts` |
| Zustand Store | `src/shared/store/index.ts` |
| 类型定义 | `src/shared/types/index.ts` |
| React 路由 | `src/app/router.tsx` |
| 全局样式 | `src/styles/globals.css` |
| 依赖版本 | `package.json` |

---

## TDD 规范

### 红绿黑循环

```
1. Red（红）    → 先写测试，测试失败（符合预期）
2. Green（绿）  → 写最少量代码让测试通过
3. Black（黑）  → 重构代码，消除重复，提升质量
4. 循环         → 重复直到功能完成
```

### 强制顺序

- **先写测试，再写实现** — 禁止在测试未就绪时写实现代码
- **测试必须独立** — 每个测试用例可单独运行，不依赖其他测试的状态
- **断言先行** — 在测试中先写断言，再补全断言前的准备逻辑

### 测试反作弊规则

#### 禁止修改测试用例以通过测试

以下行为一律禁止：

| 作弊行为 | 说明 |
|---------|------|
| 删除或注释掉失败的断言 | 失败测项必须修复，不是删除 |
| 降低断言的严格程度 | `toBe(200)` → `toBeGreaterThan(0)` |
| 缩小测试覆盖范围 | 把边界条件测试改掉 |
| 在测试中植入特殊路径 | `if (isTest) return expectedValue` |
| 修改测试数据使其永远通过 | 硬编码输入为已知输出 |

**处理方式**：发现一次，代码审查判定为 **严重违规**，打回重写。

#### 禁止扭曲代码以通过测试

以下行为一律禁止：

| 作弊行为 | 说明 |
|---------|------|
| 为通过测试添加条件判断 | `if (testMode) return fixedValue` |
| 用全局变量暂存测试期望值 | 测试依赖污染实现 |
| 复制测试期望值到实现中 | 期望值和实现逻辑耦合 |
| 绕过关心的路径 | 跳过核心逻辑走捷径 |
| 过度 mock | 把被测单元抽空，只测交互不测逻辑 |

**判断标准**：如果代码中出现了仅为"让测试通过"且无业务意义的变化，视为扭曲。

### 重构边界

- 重构只能在 **Green 阶段之后**、**Black 阶段**进行
- 重构时测试必须始终通过
- 重构不应改变代码的外在行为，只改善内部结构
- 测试本身在重构中 **不被视为可重写的部分**（测试即规格）

### 测试通过标准

| 类型 | 标准 |
|------|------|
| 单元测试 | 100% 通过，无 skipped / todo |
| 集成测试 | 核心路径必须通过 |
| 回归测试 | 所有已有功能测项必须通过 |

> 测试覆盖率是辅助指标，不是目标。覆盖率低但测得准 > 覆盖率高但测得假。

---

## Git 规范

### 分支策略

```
main         ← 稳定版本（发版分支）
dev          ← 日常开发主分支
feat/<id>   ← OpenSpec Change 独立分支
```

### 提交格式

```
<type>(<scope>): <description>

feat(bookshelf): implement BookGrid component
fix(rag): resolve SharedArrayBuffer error
refactor(mcp): extract McpManager singleton
docs(xxx): add xxx documentation
chore(deps): add @orama/orama
```

### OpenSpec Change 流程

```bash
git checkout dev && git checkout -b feat/<change-id>
# ... 开发 ...
git checkout dev && git merge feat/<change-id>
git branch -d feat/<change-id>
```

### 合并规范

- 合并到 `dev`：直接合并
- 合并到 `main`（发版）：必须 PR + 至少 1 review
- **禁止** force push 到 `main` / `dev`

---

## 版本与发布

### 分支职责

| 分支 | 职责 | 准入条件 |
|------|------|---------|
| `dev` | 日常开发集散地，所有功能先合此处 | 通过 lint + 自动化测试 |
| `main` | 稳定可发版代码，只接收大版本合并 | 必须经过完整 review + QA |
| `release/<version>` | 发版准备分支，从 main 拉出 | 用于最后打包验证 |

### 版本定义

```
major.minor.patch
  ↑      ↑     ↑
  大版本  小功能  bugfix
```

| 类型 | 触发条件 | 目标分支 |
|------|---------|---------|
| **大版本（major）** | 架构重构、破坏性变更、Phase 里程碑完成 | `main` |
| **小版本（minor）** | 新功能、功能增强 | `dev` |
| **补丁（patch）** | Bugfix、文档更新、配置调整 | `dev` |

### 发布流程

```
1. dev 累积完成一个阶段的开发
2. 创建 release/<version> 分支从 main 拉出
3. 在 release 分支做最后验证和打包测试
4. 验证通过后合入 main，打 tag
5. main 合入 dev（同步）
6. 删除 release/<version> 分支
```

### 工具流自动维护

每次工具流（BMAD / OpenSpec）执行完成后，必须自动执行：

```bash
# 1. 检查当前状态
git status

# 2. 如有变更，自动提交（基于工具流结论）
git add .
git commit -m "chore(<tool>): 完成 <tool-name> - <conclusion>"

# 3. 如在 feat 分支且完成，自动合并到 dev
if [ 当前分支 != dev ] && [ 任务完成 ]; then
  git checkout dev && git merge --no-ff feat/<id>
  git branch -d feat/<id>
fi

# 4. 确认无未合并的过时分支
git branch --merged dev | grep feat/ | xargs -r git branch -d
```

> 工具流结束后不留下游离变更，所有状态必须落库。

---

## 测试隔离

### 核心原则

**测试代码不得进入业务代码库。**

- 业务代码（`src/`、`electron/`）中 **禁止包含测试代码**
- 测试文件独立维护，与业务代码 **物理隔离**
- 测试框架配置与业务配置 **分离**

### 测试目录结构

```
ImmerseAI/
├── tests/                    # 测试代码隔离目录
│   ├── unit/                 # 单元测试
│   │   ├── rag-handler.test.ts
│   │   ├── llm-handler.test.ts
│   │   └── store.test.ts
│   ├── integration/           # 集成测试
│   │   └── ipc-flow.test.ts
│   └── e2e/                  # 端到端测试
│       └── bookshelf.test.ts
├── src/                      # 业务代码（无测试）
└── electron/                 # 业务代码（无测试）
```

### 测试导入规则

- 测试文件 **只能** import 业务代码的导出接口
- 禁止在测试中直接 import 内部实现（`src/shared/store/*.ts` → 应 import `src/shared/store/index.ts`）
- 测试不应依赖 `node_modules` 内部细节，只依赖公开 API

### 测试与业务代码耦合红线

| 耦合类型 | 判定为违规 |
|---------|-----------|
| 测试桩（mock）侵入业务代码 | `src/` 中出现 `jest.mock()`、`vi.mock()` |
| 测试工具函数混入 shared | `src/shared/` 中出现 `test/`、`mock/` |
| 条件编译绕过测试 | `if (__TEST__)` 分支 |
| 测试数据污染业务数据 | fixture 直接写在业务代码附近 |

### 测试结果处理

- 测试报告存放在 `tests/results/` 目录
- 失败的测试截图存放在 `tests/screenshots/` 目录
- CI 阶段生成 `tests/report.html` 作为质量门禁

---

## 开发命令

---

## 知识索引

遇到问题时，按以下优先级查找：

| 优先级 | 位置 | 适用场景 |
|--------|------|---------|
| **P0** | `package.json` | 依赖版本、脚本命令 |
| **P0** | `electron/main/*.ts` 源码 | 主进程逻辑 |
| **P1** | `src/shared/store/index.ts` | Zustand Store |
| **P1** | `src/shared/types/index.ts` | 核心类型 |
| **P1** | `electron/main/ipc-handlers.ts` | IPC 通道列表 |
| **P2** | `docs/known-issues.md` | 已知坑位 |
| **P3** | `test_book/Bug调试记录.md` | 历史 Bug |
| **P3** | `openspec/` | 变更追踪 |

### 架构理解路径（按此顺序阅读源码）

```
1. electron/main/index.ts          → 窗口创建 + registerIpcHandlers
2. electron/main/ipc-handlers.ts    → 所有 IPC 通道
3. electron/main/mcp-manager.ts     → StdioClientTransport 文件系统
4. electron/main/rag-handler.ts    → Chunk → Embed → Orama Search
5. electron/main/llm-handler.ts    → OpenAI Streaming → IPC 事件
6. src/app/router.tsx              → HashRouter / BrowserRouter
7. src/shared/store/index.ts       → Zustand + persist
8. src/features/{bookshelf,chat,reader,persona,settings}
```

---

## 资料放置

| 资料类型 | 放置位置 |
|---------|---------|
| 调试记录 | `test_book/无分类/Bug调试记录.md` |
| 架构优化 | `docs/superpowers/plans/`（已实现，文档归档） |
| 功能构想 | `docs/未来功能实现构想.md` |
| UI 优化 | `docs/superpowers/specs/`（已实现，文档归档） |
| 已知坑位 | `docs/known-issues.md` |
| OpenSpec 变更 | `openspec/` |
| BMAD 工作流 | `_BMAD/` |

**已废弃（勿再创建）：**
- `docs/design-reference/` — UI Mockup 已删除
- `docs/spikes/` — 实验代码片段已删除
- `docs/api-reference.md` — 以 `package.json` 为准
- `docs/screenshots/` — 空目录已删除
- `docs/架构优化方案.md` — 已实现并删除
- `docs/界面优化方案.md` — 已实现并删除
- `tests/` 以外任何位置的测试代码 — 测试必须隔离到 `tests/` 目录

---

## 开发命令

```bash
npm run dev     # 开发模式
npm run build   # 构建
npm run lint    # ESLint
npm run pack    # 打包
```

> 提交前必须通过 lint 检查，遵循 `.claude/rules/` 规范。
