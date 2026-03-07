# ImmerseAI

> 把书里的人物请出来，和他们聊天。

ImmerseAI 是一款 **Local-First** 桌面应用。它通过 MCP 协议接管你的本地书库，在设备端完成 RAG 向量化，让你可以生成书中角色的人设并与其进行沉浸式对话——所有书籍与向量索引永远留在本地，唯一出站的只有你主动发起的 LLM 请求。

---

## 它能做什么

拖入一个装满 `.md` / `.txt` 文档的文件夹，ImmerseAI 会自动扫描、索引、建立书架。选中任意一本，切换到 Chat 模式，就可以为它配置一个角色人设，然后开始对话。AI 的每一句回应都经过 RAG 检索，有据可查——点击引用可以直接跳回原文。

你还可以用自然语言指挥底部的 **Librarian Agent** 管理书架：「把这本书移到科幻文件夹」、「列出无分类里有什么」，它会调用 MCP 工具完成文件操作，并实时刷新视图。

---

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 运行时 | Electron 28+ |
| 前端 | React 18 + TypeScript strict |
| 构建 | Vite 5 + electron-vite |
| UI | TailwindCSS 3 + shadcn/ui + framer-motion |
| 全局状态 | Zustand 4 + persist middleware |
| Agent 协议 | @modelcontextprotocol/sdk（Stdio transport） |
| 端侧 RAG | @huggingface/transformers（主进程 Node.js）+ @orama/orama |
| LLM | OpenAI Compatible API，用户自定义 Base URL / Model |

架构分为三层：**渲染进程（React UI）→ 主进程（RAG + IPC 桥接 + MCP）→ 外部（LLM API）**。RAG 计算在主进程 Node.js 中执行，彻底规避渲染进程 `file://` 协议限制；UI 层通过 IPC fire-and-forget 模式异步获取进度，始终不阻塞。

---

## 快速开始

```bash
npm install
npm run dev      # 开发模式（热重载）
npm run build    # 类型检查 + 构建
npm run pack     # electron-builder 打包
```

首次启动后，在设置页填入 API Key、Base URL 和 Model 名称，然后选择一个本地目录挂载书架即可。配置通过 Zustand persist 缓存，重启后自动恢复。API Key 使用 Electron `safeStorage` 加密存储，不写入任何明文文件。

---

## 项目结构

```
immerseai/
├── electron/
│   ├── main/          # ipc-handlers · llm-handler · rag-handler · mcp-manager · safe-storage
│   └── preload/       # contextBridge 安全 API（白名单 channel）
├── src/
│   ├── app/           # 路由 · Provider
│   ├── features/      # bookshelf · reader · chat · persona · settings
│   ├── shared/        # 通用组件 · Store · 类型 · hooks
│   └── workers/       # （已迁移至主进程，目录保留供未来扩展）
├── openspec/          # 规格驱动开发文档与归档变更
├── test_book/         # 调试记录与跨设备验证样本
└── docs/              # 设计文档 · Spike 实验 · API 参考
```

---

## 开发进度

> 更新：2026-03-07 · 已归档 Changes：**18** · AT-01 ~ AT-14 全部通过

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 基建 | IPC 桥接 / Zustand Store / 路由 / 类型系统 | ✅ |
| 2 书架 | MCP Manager / BookshelfPage / 目录挂载流程 / Librarian Agent | ✅ |
| 3 大脑 | RAG 主进程 / 自适应分块 / 两阶段索引 / 混合搜索 | ✅ |
| 4 灵魂 | LLM 流式对话 / Chat UI / 角色人设生成 / 阅读器 / 设置页 | ✅ |
| 5 整合 | 引用跳转 / 测试 Skill / 打包 / Bug 调试记录体系 | ✅ |

已归档 changes（节选）：`init-scaffold` · `mcp-manager` · `bookshelf-ui` · `rag-worker-setup` · `rag-indexing` · `rag-search` · `llm-handler` · `chat-ui` · `persona-ui` · `persona-generator` · `settings-page` · `citation-jump` · `test-and-fix-skill` · `app-packaging` · `adaptive-rag-large-book`

---

## 规格与工程实践

开发流程遵循 **OpenSpec** 规格驱动范式：`proposal → design → specs → tasks → apply → verify → archive`。每个功能变更都有对应的 spec 文档和归档记录（`openspec/changes/archive/`）。

测试由 `qoobee-t&f-skill` 驱动，支持自动化代码审计（AT-01 ~ AT-14）与人工测试报告修复两种模式。调试记录维护在 `test_book/无分类/Bug调试记录.md`，每条记录附带根因分析、代码 diff 和面向面试的知识点问答。

Agent Skills 扩展（`.cursor/skills/`）包含测试修复、bug 调试记录、Vercel 工程实践等能力包，均通过关键词触发，不影响核心运行链路。

---

## License

MIT
