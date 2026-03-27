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
| 调试记录 | `test_book/Bug调试记录.md` |
| 架构优化 | `docs/架构优化方案.md` |
| 功能构想 | `docs/未来功能实现构想.md` |
| UI 优化 | `docs/界面优化方案.md` |
| 已知坑位 | `docs/known-issues.md` |
| OpenSpec 变更 | `openspec/` |
| BMAD 工作流 | `_BMAD/` |

**已废弃（勿再创建）：**
- `docs/design-reference/` — UI Mockup 已删除
- `docs/spikes/` — 实验代码片段已删除
- `docs/api-reference.md` — 以 `package.json` 为准
- `docs/screenshots/` — 空目录已删除

---

## 开发命令

```bash
npm run dev     # 开发模式
npm run build   # 构建
npm run lint    # ESLint
npm run pack    # 打包
```

> 提交前必须通过 lint 检查，遵循 `.claude/rules/` 规范。
