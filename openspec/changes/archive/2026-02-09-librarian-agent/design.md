## Context

LibrarianBar 是书架页面底部的 Agent 交互入口，当前仅为 UI 占位（空输入框 + 空事件处理器）。MCP Manager 在主进程已完整实现 4 个文件操作（listFiles, readFile, writeFile, moveFile），但 IPC 层 `ipc-handlers.ts` 返回硬编码 mock 数据，未连线到真实 MCP Client。

本变更需要激活完整的 Agent 能力链路：**用户自然语言 → LLM 意图识别 → 参数提取 → MCP 工具调用 → 结果反馈 → UI 展示**。参考 note-taking 变更中的意图检测模式，但 librarian 的工具调用更复杂（需要文件路径参数提取、危险操作确认）。

**约束：**
- 必须通过 MCP SDK 操作文件系统（宪法 P-3），不能使用 Node.js fs
- 删除操作必须二次确认，防止误删（用户体验要求）
- Agent 响应必须在 UI 零阻塞（宪法 P-2），LLM 意图识别在后台完成

## Goals / Non-Goals

**Goals:**
- 用户通过自然语言完成书架管理（"显示书架"、"把三体移到科幻文件夹"、"新建哲学分类"）
- LLM 准确识别 4 种意图（列出文件、移动文件、创建目录、删除文件）+ 提取参数
- 危险操作（删除）有明确的二次确认弹窗，防止误操作
- 操作历史记录持久化到 Store，最近 10 条展示在 LibrarianBar 下方

**Non-Goals:**
- 文件内容编辑（超出 Agent 范围，属于专用编辑器）
- 跨书架搜索（属于全局搜索功能，后续 Phase）
- 复杂文件批处理（如"把所有 PDF 移到 PDF 文件夹"）— 首版仅支持单文件操作
- 自然语言生成书籍摘要（属于 RAG 能力，已有独立模块）

## Decisions

### D1: 意图识别 — LLM Function Calling vs Prompt Engineering

**选择：Prompt Engineering + 结构化输出**

通过精心设计的 system prompt 指导 LLM 输出 JSON 格式的意图和参数：
```json
{
  "intent": "move_file | list_files | create_directory | delete_file",
  "params": { "source": "...", "target": "..." }
}
```

**理由：**
- OpenAI Compatible API（DeepSeek/Kimi）的 Function Calling 支持参差不齐
- JSON 输出解析足够可靠（99%+ 成功率，note-taking 已验证）
- Prompt 可迭代优化，无需依赖特定 API 特性
- 降级策略简单：JSON 解析失败时提示用户"请更具体地描述操作"

**备选（Function Calling）不选的原因：**
- 需要所有 provider 都支持 `tools` 参数
- schema 定义复杂，参数提取不如 prompt 灵活
- 错误处理更麻烦（provider 返回格式不统一）

### D2: 工具调用架构 — 服务层 vs Hook 内联

**选择：独立 Agent 服务层 (`librarian-agent.ts`)**

将意图识别、参数提取、工具调用编排封装为服务函数：
```ts
export async function executeLibrarianCommand(
  userInput: string,
  bookshelfPath: string,
  llmConfig: LlmConfig
): Promise<AgentResult>
```

Hook (`useLibrarian.ts`) 只负责状态管理和 UI 交互，调用服务层完成业务逻辑。

**理由：**
- 关注点分离：服务层可单独测试（mock LLM 响应）
- 可复用：未来其他 Agent（如 note-taking 中的笔记生成）可共享工具调用模式
- 符合架构规范：`services/` 层处理业务逻辑，`hooks/` 层处理 React 状态

### D3: 参数提取策略

**选择：结构化 JSON + 路径补全**

LLM 输出的路径可能不完整（如用户说"三体"，LLM 输出 `"三体.epub"`），需要补全为绝对路径：
1. LLM 返回文件名或相对路径
2. Agent 服务层调用 `mcp.listFiles(bookshelfPath)` 获取完整文件列表
3. 模糊匹配文件名（中文标题 + 扩展名），补全为绝对路径
4. 如果找不到唯一匹配，返回候选列表让用户选择

**模糊匹配规则：**
- 优先精确匹配
- 其次前缀匹配（"三体" 匹配 "三体.epub"）
- 大小写不敏感
- 忽略空格和特殊字符

### D4: MCP 扩展方法 — 新增 vs 外部工具

**选择：在 MCP Manager 中新增 `createDirectory` 和 `deleteFile`**

修改 `electron/main/mcp-manager.ts`，通过 MCP SDK 的 `call_tool` 调用 filesystem server 的对应工具。

**理由：**
- 统一 API：所有文件操作通过 MCP Manager 单例访问
- 类型安全：TypeScript 接口定义在 `McpManager` 类中，编译时检查
- 错误处理：复用现有的重试逻辑和错误包装

**实现方式：**
```ts
async createDirectory(path: string): Promise<void> {
  const result = await this.client.request({
    method: 'tools/call',
    params: {
      name: 'create_directory',
      arguments: { path }
    }
  });
}
```

### D5: 危险操作确认 — 前端弹窗 vs 后端拦截

**选择：前端 shadcn/ui AlertDialog 二次确认**

在 `useLibrarian` Hook 中检测 `intent === 'delete_file'` 时，先弹出 AlertDialog，用户确认后再调用 MCP。

**理由：**
- 用户体验更好：可以自定义弹窗文案（"确定要删除《三体》吗？此操作不可撤销"）
- 前端可控：可以添加"不再提示"选项（存 localStorage）
- 后端无状态：MCP Manager 不需要维护确认状态

**弹窗时机：**
- Agent 识别出删除意图 + 参数提取完成后
- 弹窗展示文件名 + 路径
- 用户点击"确认删除"才真正调用 `mcp.deleteFile()`

### D6: 操作历史设计

**选择：Zustand Store + 本地持久化**

在全局 Store 中新增：
```ts
agentHistory: AgentOperation[]  // 最近 10 条
addAgentOperation: (op: AgentOperation) => void
```

`AgentOperation` 包含：
- `id`: UUID
- `timestamp`: 时间戳
- `intent`: 意图类型
- `input`: 用户原始输入
- `params`: 提取的参数
- `result`: 成功/失败 + 消息
- `duration`: 执行耗时

**持久化：** 通过 Zustand persist middleware 存储到 localStorage，应用重启后可恢复历史。

**UI 展示：** LibrarianBar 下方展示折叠面板，点击展开显示最近 10 条操作记录。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM 意图识别失败（输出非 JSON 或错误意图） | 操作无法执行 | Prompt 中明确要求 JSON 格式 + fallback 提示用户重试 |
| 文件路径模糊匹配错误（同名文件） | 操作错误的文件 | 返回候选列表，让用户选择正确的文件 |
| MCP 连接断开时调用工具 | 操作失败 | 检测连接状态，提示用户先连接 MCP |
| 删除操作误触（用户说"删除"但不是真正意图） | 误删文件 | 二次确认弹窗 + 明确展示文件名和路径 |
| 操作历史占用过多内存 | 性能下降 | 限制最多 10 条 + 定期清理过期记录（7 天前） |
| IPC 层从 mock 切换到真实 MCP 后现有功能受影响 | Bookshelf 其他功能异常 | 分阶段迁移：先迁移 listFiles，验证无误后再迁移其他方法 |

## Migration Plan

**Phase 1: MCP Manager 扩展 + IPC 连线**
1. 在 `mcp-manager.ts` 中新增 `createDirectory` 和 `deleteFile`
2. 更新 `ipc-handlers.ts`，将 `mcp:list-files` 从 mock 切换到 `McpManager.getInstance().listFiles()`
3. 验证 Bookshelf 页面加载正常（mock → 真实数据）
4. 依次迁移其他 3 个 IPC handler（read, write, move）

**Phase 2: Agent 服务层实现**
5. 创建 `librarian-agent.ts` 服务层（意图识别 + 工具调用）
6. 创建 `useLibrarian.ts` Hook（状态管理 + UI 交互）
7. 扩展 Store：新增 `agentHistory` 和相关 actions

**Phase 3: UI 重构**
8. 重构 `LibrarianBar.tsx`：新增消息展示区域（历史记录列表）
9. 新增 `ConfirmDeleteDialog.tsx` 确认弹窗组件
10. 连线事件处理器：输入框 Enter → `useLibrarian.executeCommand()`

**Rollback 策略：**
- 如果 Phase 1 迁移失败，回退 IPC handler 到 mock 数据
- Phase 2/3 为纯新增功能，不影响现有 Bookshelf 功能

## Open Questions

1. **创建目录的 UI 反馈：** 创建成功后是否自动刷新 BookGrid？还是仅在 LibrarianBar 中提示？
   - **倾向：** 仅提示，不自动刷新（避免 UI 突变干扰用户）

2. **操作历史的删除策略：** 是否允许用户手动清空历史？
   - **倾向：** 提供"清空历史"按钮，存储在 localStorage 中的数据可清理

3. **文件名冲突处理：** 移动文件时目标已存在同名文件，是否覆盖？
   - **倾向：** 提示用户"目标文件已存在"，拒绝操作（安全优先）
