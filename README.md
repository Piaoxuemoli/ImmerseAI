# ImmerseAI

> Local-First 沉浸式阅读与角色扮演 Agent 桌面应用

ImmerseAI 通过 MCP (Model Context Protocol) 连接本地书库，利用端侧 RAG 理解书籍内容，支持生成书中角色并进行沉浸式对话。所有书籍与向量索引均保留在本地，唯一出站流量为 LLM API 调用。

## 亮点

- **数据主权** — 书籍与索引完全本地化
- **端侧 RAG** — Web Worker + Orama + Transformers.js，UI 零阻塞
- **MCP 集成** — 以安全 IPC 桥接本地文件系统
- **沉浸式对话** — 角色人设生成 + 流式对话 + 引用跳转
- **可打包交付** — electron-builder 一键出包

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Electron 28+ |
| 前端 | React 18 + TypeScript (strict) |
| 构建 | Vite 5 + electron-vite |
| UI | TailwindCSS + shadcn/ui + framer-motion |
| 状态管理 | Zustand 4 (persist middleware) |
| Agent 协议 | @modelcontextprotocol/sdk |
| 本地 RAG | @xenova/transformers + @orama/orama |
| LLM | OpenAI Compatible API (DeepSeek / Kimi / Moonshot) |
| 电子书 | react-reader (epub.js) |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包
npm run pack
```

## 项目结构

```
immerseai/
├── electron/                   # Electron 主进程
│   ├── main/                   # ipc-handlers, llm-handler, mcp-manager
│   └── preload/                # contextBridge 安全 API
├── src/                        # 渲染进程 (React)
│   ├── app/                    # 路由 / Provider
│   ├── features/               # bookshelf / reader / chat / persona / settings
│   ├── shared/                 # 通用组件、Store、类型
│   ├── workers/                # RAG Worker
│   └── styles/                 # TailwindCSS 全局样式
├── openspec/                   # 规格驱动开发 (OpenSpec)
│   ├── specs/                  # 主规格文档
│   └── changes/archive/        # 已归档变更记录
├── test_book/                  # 跨设备测试用书
└── docs/                       # 设计文档、Spike 实验
```

## 进度概览

> 更新日期：2026-02-09  
> 已归档 Changes：**17**  
> 活跃 Change：**无**  
> 最近一次自动化验证：**AT-01 ~ AT-14 全通过**  

### Phase 状态

| Phase | 模块 | 状态 |
|-------|------|------|
| Phase 1 基建 | IPC / Store / 路由 / 类型 | ✅ 完成 |
| Phase 2 书架 | MCP / Bookshelf / Mount 流程 | ✅ 完成 |
| Phase 3 大脑 | RAG Worker / Index / Search | ✅ 完成 |
| Phase 4 灵魂 | LLM / Chat / Persona / Reader / Settings | ✅ 完成 |
| Phase 5 整合 | 引用跳转 / 测试 Skill / App 打包 | ✅ 完成（macOS 安装验证待复测） |

### 已归档 Changes（节选）

- init-scaffold / init-ipc-bridge / init-store
- mcp-manager / bookshelf-ui
- rag-worker-setup / rag-indexing / rag-search
- llm-handler / chat-ui / epub-reader / persona-ui / persona-generator / settings-page
- citation-jump / test-and-fix-skill
- app-packaging

## 测试体系

项目采用双模测试策略（自动化 + 人工），由 `qoobee-t&f-skill` 驱动。

- 自动化测试项定义：`docs/test-classification.md`
- Skill 定义：`.cursor/skills/qoobee-t&f-skill/SKILL.md`
- 测试样书：`test_book/`（用于跨设备验证）

## 规格驱动开发 (OpenSpec)

```
proposal → design + specs → tasks → apply → verify → archive
```

- 主规格文档：`openspec/specs/`
- 归档记录：`openspec/changes/archive/`

## License

MIT
