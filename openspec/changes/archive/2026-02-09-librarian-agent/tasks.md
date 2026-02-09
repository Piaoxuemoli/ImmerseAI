## 1. MCP Manager 扩展

- [x] 1.1 在 `electron/main/mcp-manager.ts` 中新增 `createDirectory(path: string): Promise<void>` 方法，调用 MCP Tool 'create_directory'
- [x] 1.2 在 `electron/main/mcp-manager.ts` 中新增 `deleteFile(path: string): Promise<void>` 方法，调用 MCP Tool 'delete_file'
- [x] 1.3 为新方法添加日志记录（操作开始、完成、错误）

## 2. IPC 层连线（从 Mock 到真实 MCP）

- [x] 2.1 修改 `electron/main/ipc-handlers.ts` 的 `mcp:list-files` handler，从 mock 数据切换到 `McpManager.getInstance().listFiles(path)`
- [x] 2.2 修改 `ipc-handlers.ts` 的 `mcp:read-file` handler，调用 `McpManager.getInstance().readFile(path)`
- [x] 2.3 修改 `ipc-handlers.ts` 的 `mcp:write-file` handler，调用 `McpManager.getInstance().writeFile(path, content)`
- [x] 2.4 修改 `ipc-handlers.ts` 的 `mcp:move-file` handler，调用 `McpManager.getInstance().moveFile(source, destination)`
- [x] 2.5 新增 `mcp:create-directory` IPC handler，调用 `McpManager.getInstance().createDirectory(path)`
- [x] 2.6 新增 `mcp:delete-file` IPC handler，调用 `McpManager.getInstance().deleteFile(path)`

## 3. Preload Bridge 扩展

- [x] 3.1 在 `electron/preload/index.ts` 中新增 `createDirectory: (path: string) => Promise<void>` 方法，调用 `mcp:create-directory` channel
- [x] 3.2 在 `electron/preload/index.ts` 中新增 `deleteFile: (path: string) => Promise<void>` 方法，调用 `mcp:delete-file` channel
- [x] 3.3 更新 `src/shared/types/electron.d.ts` 的 `ElectronAPI.mcp` 接口，添加两个新方法签名

## 4. 类型定义

- [x] 4.1 在 `src/shared/types/index.ts` 中新增 `AgentIntent` 类型：`'list_files' | 'move_file' | 'create_directory' | 'delete_file' | 'unknown'`
- [x] 4.2 新增 `AgentOperation` 接口：`{ id, timestamp, intent, input, params, result: 'success' | 'error', message, duration }`
- [x] 4.3 新增 `IntentRecognitionResult` 接口：`{ intent: AgentIntent, params: Record<string, string> }`

## 5. Store 扩展

- [x] 5.1 在 Zustand Store 中新增 `agentHistory: AgentOperation[]` 状态和 `addAgentOperation(op: AgentOperation)` action
- [x] 5.2 实现 `addAgentOperation` 逻辑：追加操作 + 限制最多 10 条（移除最早）
- [x] 5.3 新增 `clearAgentHistory()` action 清空历史
- [x] 5.4 将 `agentHistory` 加入 persist 持久化列表

## 6. Agent 服务层

- [x] 6.1 创建 `src/features/bookshelf/services/librarian-agent.ts`，实现 `recognizeIntent(userInput: string, llmConfig: LlmConfig): Promise<IntentRecognitionResult>` 函数，调用 LLM 识别意图并解析 JSON 输出
- [x] 6.2 创建 `src/features/bookshelf/utils/path-resolver.ts`，实现 `resolvePath(partial: string, bookshelfPath: string): Promise<{ type: 'single', path: string } | { type: 'multiple', candidates: string[] } | { type: 'not_found' }>` 函数，模糊匹配文件路径
- [x] 6.3 在 `librarian-agent.ts` 中实现 `executeLibrarianCommand(userInput: string, bookshelfPath: string, llmConfig: LlmConfig): Promise<{ success: boolean, message: string, operation: Partial<AgentOperation>, needsConfirmation?: boolean, deleteParams?: any }>` 编排函数

## 7. useLibrarian Hook

- [x] 7.1 创建 `src/features/bookshelf/hooks/useLibrarian.ts`，实现 Hook 封装 Agent 状态管理
- [x] 7.2 在 Hook 中实现 `executeCommand` 方法：调用 `executeLibrarianCommand` → 记录 operation → 更新 Store
- [x] 7.3 实现 `confirmDelete` 方法：执行真正的删除操作 + 记录结果
- [x] 7.4 Hook 返回值包含 `history`, `isExecuting`, `executeCommand`, `confirmDelete`, `clearHistory`

## 8. UI 组件

- [x] 8.1 创建 `src/features/bookshelf/components/ConfirmDeleteDialog.tsx`，shadcn/ui AlertDialog 实现删除确认弹窗
- [x] 8.2 创建 `src/features/bookshelf/components/AgentHistoryItem.tsx`，单条历史记录展示组件（绿色成功/红色失败 + 时间戳）
- [x] 8.3 重构 `src/features/bookshelf/components/LibrarianBar.tsx`：集成 `useLibrarian` hook，连线输入框 Enter 事件和发送按钮点击事件
- [x] 8.4 在 `LibrarianBar.tsx` 中新增历史记录列表展示区域（折叠面板，最多 10 条）
- [x] 8.5 在 `LibrarianBar.tsx` 中集成 `ConfirmDeleteDialog`，删除意图时弹出确认

## 9. Agent System Prompt

- [x] 9.1 创建 `src/features/bookshelf/utils/librarian-prompt.ts`，定义 Agent 的 system prompt 模板，明确意图识别和 JSON 输出格式要求

## 10. 验证与收尾

- [x] 10.1 确保 TypeScript 编译通过（`tsc --noEmit` 零错误）— 新增代码无错误，预存在的 3 个类型错误不属于本变更范围
- [x] 10.2 验证意图识别覆盖 4 种操作类型（list/move/create/delete）
- [x] 10.3 验证删除确认弹窗正确弹出且可取消
- [x] 10.4 验证操作历史正确记录且持久化
- [x] 10.5 验证 MCP 未连接时的错误提示
