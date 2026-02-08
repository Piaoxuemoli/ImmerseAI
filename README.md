# ImmerseAI

> Local-First 沉浸式阅读与角色扮演 Agent 桌面应用

ImmerseAI 通过 MCP (Model Context Protocol) 连接本地书库，利用端侧 RAG 技术理解书籍内容，允许用户创建"书中角色"进行跨时空对话。

## 核心特性

- **数据主权** — 书籍文件与向量索引完全本地化，唯一出站流量是 LLM API 调用
- **端侧 RAG** — Web Worker 中运行 Transformers.js + Orama 向量数据库，UI 零阻塞
- **MCP 集成** — 通过 Model Context Protocol 管理本地文件系统（书籍、笔记）
- **角色扮演** — 基于 RAG 自动生成角色人设，沉浸式对话
- **流式对话** — LLM 流式响应，打字机效果实时展示

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
│   │   └── mcp-manager.ts      # MCP Client 管理器 (单例)
│   └── preload/
│       └── index.ts            # contextBridge 安全 API
├── src/                        # 渲染进程 (React)
│   ├── app/                    # 根组件、路由、Provider
│   ├── features/               # 功能模块
│   │   ├── bookshelf/          # 书架管理
│   │   ├── reader/             # EPUB 阅读器
│   │   ├── chat/               # 对话界面 + 流式 Hook
│   │   └── persona/            # 角色管理
│   ├── shared/                 # 通用组件、Store、类型
│   ├── workers/                # Web Worker (RAG 引擎)
│   └── styles/                 # TailwindCSS 全局样式
├── openspec/                   # 规格驱动开发 (OpenSpec)
│   ├── specs/                  # 主规格文档
│   └── changes/archive/        # 已归档的变更记录
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

### 已完成 (9/18 Changes Archived)

| Phase | Change | 说明 |
|-------|--------|------|
| 1 基建 | init-scaffold | Electron + Vite + React + TS 脚手架 |
| 1 基建 | init-ipc-bridge | IPC 通信管道 + preload 安全桥 |
| 1 基建 | init-store | Zustand 全局状态 Store |
| 2 书架 | mcp-manager | MCP Client 单例 + Stdio 子进程管理 |
| 2 书架 | bookshelf-ui | 书架网格视图 + 书籍卡片 |
| 3 大脑 | rag-worker-setup | Web Worker 环境 + Transformers.js 集成 |
| 3 大脑 | rag-indexing | Orama 向量索引 + IndexedDB 持久化 |
| 4 灵魂 | llm-handler | LLM API 流式调用 + safeStorage 密钥管理 |
| 4 灵魂 | chat-ui | 对话界面组件 + useChat 流式 Hook |

### 待开发

- rag-search — 语义检索接口
- epub-reader — EPUB 阅读器集成
- persona-ui — 角色配置弹窗
- persona-generator — RAG + LLM 自动人设生成
- settings-page — API Key 配置页
- citation-jump — 引用跳转到原文
- note-taking — MCP write_file 笔记功能
- librarian-agent — 自然语言书架管理
- error-handling — 全局错误边界
- app-packaging — Electron 打包分发

## 设计哲学

```
"读书不觉已春深，一寸光阴一寸金。" —— 沉浸，是最高的尊重。
```

- **极简主义** — Notion 风格，黑白灰主色调，内容为王
- **渐进式复杂度** — 拖入一本书即可开始，高级功能自然发现
- **可预测性** — Agent 的每个动作对用户透明，可撤销

## License

MIT
