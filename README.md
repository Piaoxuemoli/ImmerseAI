# ImmerseAI

> Local-First 沉浸式阅读与角色扮演 Agent 桌面应用

ImmerseAI 通过 MCP (Model Context Protocol) 连接本地书库，利用端侧 RAG 技术理解书籍内容，允许用户创建"书中角色"进行跨时空对话。

## 核心特性

- **数据主权** — 书籍文件与向量索引完全本地化，唯一出站流量是 LLM API 调用
- **端侧 RAG** — Web Worker 中运行 Transformers.js + Orama 向量数据库，UI 零阻塞
- **MCP 集成** — 通过 Model Context Protocol 管理本地文件系统（书籍、笔记）
- **角色扮演** — 基于 RAG 自动生成角色人设，沉浸式对话
- **流式对话** — LLM 流式响应，打字机效果实时展示
- **引用跳转** — 对话中的书籍引用可点击跳转到 EPUB 原文，高亮定位

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Electron 28+ |
| 前端 | React 18 + TypeScript (strict) |
| 构建 | Vite 5 + electron-vite |
| UI | TailwindCSS + shadcn/ui + framer-motion |
| 状态管理 | Zustand 4 (persist middleware) |
| Agent 协议 | @modelcontextprotocol/sdk |
| 本地 RAG | @xenova/transformers (all-MiniLM-L6-v2) + @orama/orama |
| LLM | OpenAI Compatible API (DeepSeek / Kimi / Moonshot) |
| 电子书 | react-reader (epub.js) |

## 项目结构

```
immerseai/
├── electron/                   # Electron 主进程
│   ├── main/
│   │   ├── index.ts            # 主进程入口
│   │   ├── ipc-handlers.ts     # IPC 路由注册
│   │   ├── llm-handler.ts      # LLM API 流式调用处理
│   │   ├── mcp-manager.ts      # MCP Client 管理器 (单例)
│   │   └── safe-storage.ts     # API Key 加密存储
│   └── preload/
│       └── index.ts            # contextBridge 安全 API
├── src/                        # 渲染进程 (React)
│   ├── app/                    # 根组件、路由、Provider
│   ├── features/               # 功能模块
│   │   ├── bookshelf/          # 书架管理
│   │   ├── reader/             # EPUB 阅读器 + 引用跳转
│   │   ├── chat/               # 对话界面 + 流式 Hook + 人设生成
│   │   ├── persona/            # 角色管理
│   │   └── settings/           # 设置页 (LLM 配置)
│   ├── shared/                 # 通用组件、Store、类型
│   ├── workers/                # Web Worker (RAG 引擎)
│   └── styles/                 # TailwindCSS 全局样式
├── openspec/                   # 规格驱动开发 (OpenSpec)
│   ├── specs/                  # 主规格文档
│   └── changes/archive/        # 已归档的变更记录 (16 项)
└── docs/                       # 设计文档、Spike 实验
```

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 开发进度

> 更新日期：2026-02-09 | 已归档 Changes：**16** | 活跃 Change：**app-packaging（Windows 已验证，macOS 后续跟进）** | 最近一次全量验证：**16/16 PASS**

### Phase 总览

| Phase | 模块 | Changes | 状态 |
|-------|------|---------|------|
| Phase 1 基建 | IPC / Store / 路由 / 类型 | 3/3 | ✅ 全部完成 |
| Phase 2 书架 | McpManager / BookshelfUI | 2/2 | ✅ 全部完成 |
| Phase 3 大脑 | RAG Worker (ingest + search) | 3/3 | ✅ 全部完成 |
| Phase 4 灵魂 | LLM / Chat / Persona / Reader / Settings | 6/6 | ✅ 全部完成 |
| Phase 5 整合 | 引用跳转 / 测试 Skill | 2/2 | ✅ 全部完成 |

### 已完成 (16 Changes Archived + Verified)

| Phase | Change | 说明 | 验证 |
|-------|--------|------|------|
| 1 基建 | init-scaffold | Electron + Vite + React + TS 脚手架 | ✅ 7/7 reqs |
| 1 基建 | init-ipc-bridge | IPC 通信管道 + preload 安全桥 | ✅ 12/13 reqs |
| 1 基建 | init-store | Zustand 全局状态 Store | ✅ 10/10 reqs |
| 2 书架 | mcp-manager | MCP Client 单例 + Stdio 子进程管理 | ✅ 8/8 reqs |
| 2 书架 | bookshelf-ui | 书架网格视图 + 书籍卡片 | ✅ 9/9 reqs |
| 3 大脑 | rag-worker-setup | Web Worker 环境 + Transformers.js 集成 | ✅ 全部 reqs |
| 3 大脑 | rag-indexing | Orama 向量索引 + IndexedDB 持久化 | ✅ 全部 reqs |
| 3 大脑 | rag-search | 语义检索接口 + Top-K 向量搜索 | ✅ 全部 reqs |
| 4 灵魂 | llm-handler | LLM API 流式调用 + safeStorage 密钥管理 | ✅ 15/15 reqs |
| 4 灵魂 | chat-ui | 对话界面组件 + useChat 流式 Hook | ✅ 19/19 reqs |
| 4 灵魂 | epub-reader | EPUB 阅读器集成 (react-reader) | ✅ 20/20 reqs |
| 4 灵魂 | persona-ui | 角色配置弹窗 (PersonaConfigDialog) | ✅ 21/21 reqs |
| 4 灵魂 | persona-generator | RAG + LLM 自动人设生成服务 | ✅ 18/18 reqs |
| 4 灵魂 | settings-page | LLM 配置 + API Key 安全存储 + 连接测试 | ✅ 11/11 reqs |
| 5 整合 | citation-jump | 对话引用跳转 EPUB 原文 + 高亮 | ✅ 8/8 reqs |
| 工具链 | test-and-fix-skill | Copilot Agent 双模测试与修复 Skill | ✅ 5/5 reqs |

### 全量验证结果

```
总 Changes:      16/16 PASS
CRITICAL 问题:   0
WARNING 问题:    11 (均为低风险，已修复主要项)
SUGGESTION:      15 (代码改进建议)
任务完成率:      517/525 (98.5%)
```

### 待开发（后续 Phase）

- **Phase 2 补全**：ipc-mcp-bridge（IPC 接入真实 MCP）、bookshelf-hook、bookshelf-wiring
- **Phase 5 扩展**：note-taking（MCP 笔记）、librarian-agent（智能书架管理）
- **后续跟进**：app-packaging（macOS `.dmg` 打包与安装验证）

---

## 测试体系

项目采用**双模测试策略**，通过 Copilot Agent Skill (`qoobee-t&f-skill`) 驱动。

### 自动化测试 (Agent 执行)

| ID | 测试项 | 验证目标 |
|----|--------|----------|
| AT-01 | TypeScript 编译检查 | `tsc --noEmit` + `electron-vite build` 零错误 |
| AT-02 | 依赖完整性检查 | package.json 与代码 import 一致 |
| AT-03 | Zustand Store 一致性 | Store 实现 ↔ ImmerseStore 接口对齐 |
| AT-04 | IPC Channel 完整性 | preload 暴露 ↔ ipc-handlers 注册一致 |
| AT-05 | 路由配置完整性 | `/bookshelf`、`/reader/:id`、`/settings` 可达且组件存在 |
| AT-06 | IPC Handlers 真实桥接 | `mcp:*` handlers 调用真实 McpManager（无 mock） |
| AT-07 | BookCard 路由跳转 | 点击书籍卡片能进入 `/reader/:id` |
| AT-08 | 挂载书架流程 | 选目录 → MCP connect → listFiles → 书架渲染 |
| AT-09 | Worker 消息协议完整性 | rag-types.ts ↔ worker ↔ hook 覆盖完整 |
| AT-10 | Persona Prompt 模板 | 模板结构符合宪法要求 |
| AT-11 | 安全配置检查 | nodeIntegration=false, contextIsolation=true 等 |
| AT-12 | 设置页存在性 | `/settings` 页面存在且可导航 |
| AT-13 | shadcn/ui 组件完整性 | 引用的 UI 组件文件齐全 |
| AT-14 | electron.d.ts 声明 | Window.electronAPI 类型与 preload 一致 |

> 自动化测试完成后，Skill 还会输出 **CR（Code Review）报告**（CRITICAL/WARNING/SUGGESTION 三档），用于快速审阅风险点。

### 人工测试 (需手动验证)

| ID | 测试项 | 验证目标 |
|----|--------|----------|
| HT-01 | Electron 窗口启动 | 3 秒内展示主窗口 |
| HT-02 | 书架渲染与交互 | 网格布局，2:3 卡片，hover 动效 |
| HT-03 | EPUB 阅读器 | 翻页、字号调节、进度记忆 |
| HT-04 | 阅读/对话模式切换 | framer-motion 平滑过渡 |
| HT-05 | LLM 流式对话 | 打字机效果，<2s 首 Token |
| HT-06 | 角色人设生成 | RAG 检索 → LLM 生成 → UI 回填 |
| HT-07 | 设置页功能 | Provider 切换、Key 存储、连接测试 |
| HT-08 | MCP 书架挂载 | 选目录 → 扫描 .epub → 展示 |
| HT-09 | 引用跳转 | 点击 CitationBadge → 跳转 EPUB + 高亮 |
| HT-10 | 打包分发 | .exe/.dmg 安装运行正常（macOS 后续） |

> 详细测试定义见 `docs/test-classification.md`，Skill 定义见 `.cursor/skills/qoobee-t&f-skill/SKILL.md`

## 规格驱动开发 (OpenSpec)

本项目使用 [OpenSpec](https://github.com/openspec) 进行规格驱动开发。每个功能变更遵循以下流程：

```
proposal → design + specs → tasks → apply → verify → archive
```

- 主规格文档：`openspec/specs/` (20+ spec 文件)
- 归档记录：`openspec/changes/archive/` (16 个已验证变更)
- 项目宪法：`.github/copilot-instructions.md`

## 设计哲学

```
"读书不觉已春深，一寸光阴一寸金。" —— 沉浸，是最高的尊重。
```

- **极简主义** — Notion 风格，黑白灰主色调，内容为王
- **渐进式复杂度** — 拖入一本书即可开始，高级功能自然发现
- **可预测性** — Agent 的每个动作对用户透明，可撤销

## License

MIT
