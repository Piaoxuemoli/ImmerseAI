## Why

LibrarianBar 组件目前仅为 UI 空壳（占位输入框 + 空事件处理器），无法响应用户的自然语言指令。项目宪法 P-3 明确要求 Agent 具备副作用能力，包括管理文件系统（MCP Tools）。用户需要通过自然语言与书架交互（"显示我的书架"、"把三体移到科幻文件夹"），而非手工操作文件资源管理器。当前 MCP Manager 已实现但 IPC 层返回 mock 数据，需要真正的 Agent 能力来激活这条链路。

## What Changes

- 激活 LibrarianBar 的自然语言交互能力，通过 LLM 识别用户意图（列出文件、移动文件、创建目录、删除文件）
- 新增 Agent 服务层：将用户输入 → LLM 意图识别 → 参数提取 → MCP 工具调用 → 结果展示形成完整闭环
- 扩展 MCP Manager：新增 `createDirectory` 和 `deleteFile` 方法（当前仅支持 4 个操作）
- 连线 IPC 层：将 `ipc-handlers.ts` 从 mock 数据切换到真实 `McpManager.getInstance()` 调用
- 新增危险操作确认机制：删除文件前弹出 shadcn/ui AlertDialog 二次确认
- 新增操作历史记录：在 Store 中维护最近 10 条操作记录，展示在 LibrarianBar 下方

## Capabilities

### New Capabilities
- `librarian-agent`: LibrarianBar 的 Agent 核心能力，包含意图识别、工具调用编排、历史记录管理

### Modified Capabilities
- `mcp-manager`: 扩展 MCP Manager 新增 `createDirectory` 和 `deleteFile` 方法，更新 IPC 通道定义
- `bookshelf-ui`: LibrarianBar 组件新增消息展示区域（操作历史 + 结果反馈），替换当前的纯输入框 UI

## Impact

- **主进程**：`electron/main/mcp-manager.ts` — 新增 `createDirectory` 和 `deleteFile` 方法
- **IPC 层**：`electron/main/ipc-handlers.ts` — 移除 mock 数据，调用 `McpManager.getInstance()` 真实方法
- **Preload 桥**：`electron/preload/index.ts` — 新增 `mcp:create-directory` 和 `mcp:delete-file` 通道
- **类型定义**：`src/shared/types/` — 新增 `AgentIntent`, `AgentOperation`, `AgentHistory` 等类型
- **渲染进程**：
  - `src/features/bookshelf/components/LibrarianBar.tsx` — 重构为可交互 UI
  - `src/features/bookshelf/services/librarian-agent.ts` — 新增 Agent 服务层
  - `src/features/bookshelf/hooks/useLibrarian.ts` — 新增状态管理 Hook
- **Store**：Zustand Store 新增 `agentHistory: AgentOperation[]` 和相关 actions
- **依赖**：无新依赖，复用现有 LLM SDK、MCP SDK 和 shadcn/ui 组件
