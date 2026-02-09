## Why

ImmerseAI 项目宪法 P-3 明确要求 Agent 具备**副作用能力**，包括通过 MCP Tools 记录笔记（write_file）。目前对话系统只能聊天，无法将阅读洞察持久化。用户在沉浸式对话中产生的想法和笔记会随对话消散，缺少一个"从对话到笔记"的闭环。

## What Changes

- 新增对话中"记笔记"意图检测机制，识别用户的记笔记指令（"记笔记"/"做笔记"/"记一下"等）
- 新增 LLM 笔记生成流程：基于当前对话上下文，调用 LLM 生成结构化 Markdown 笔记
- 新增 IPC → MCP `writeFile` 调用链路，将笔记写入用户书架目录下的 `notes/` 文件夹
- 新增笔记文件命名规范：`{书名}-{日期}-{主题}.md`
- 新增写入确认消息：成功后在对话中展示确认及文件路径
- 新增追加模式：支持向已有笔记文件追加内容

## Capabilities

### New Capabilities
- `note-taking`: 对话中检测记笔记意图，LLM 生成结构化 Markdown，通过 MCP 写入本地文件系统，支持新建和追加模式

### Modified Capabilities
- `chat-streaming`: useChat hook 需要扩展以支持笔记意图检测和笔记生成流程，在 sendMessage 中增加分支逻辑
- `chat-interface`: 需要新增笔记确认消息的 UI 展示组件（NoteConfirmation），区别于普通对话消息

## Impact

- **渲染进程**：`src/features/chat/` — useChat hook 扩展、新增 NoteConfirmation 组件、笔记意图检测工具函数
- **主进程**：`electron/main/ipc-handlers.ts` — 可能需要新增 `mcp:ensure-dir` channel 确保 notes/ 目录存在
- **IPC 通道**：复用已有 `mcp:write-file`，可能新增 `mcp:append-file` 或 `mcp:read-file` 用于追加模式
- **类型定义**：`src/shared/types/` — 新增 NoteMessage 类型或扩展 Message 类型
- **依赖**：无新依赖，复用现有 MCP SDK + LLM SDK
