## Context

ImmerseAI 当前对话系统（`useChat` hook + `ChatInterface`）已实现完整的 LLM 流式对话、Persona 人设和 Citation 引用跳转。MCP Manager 已具备 `writeFile` 和 `readFile` 能力，通过 preload bridge 暴露给渲染进程（`window.electronAPI.mcp.writeFile`）。

本变更需要在现有对话流程中插入一条"笔记分支"——当用户表达记笔记意图时，不走常规对话，而是触发笔记生成和写入流程。

**约束：**
- 笔记写入必须通过 MCP `writeFile`（宪法 P-3），不能使用 Node.js fs
- 笔记生成必须在现有 LLM 调用链路上完成，不引入新的 LLM 通道
- UI 不能阻塞主对话流（宪法 P-2）

## Goals / Non-Goals

**Goals:**
- 用户在对话中说"记笔记"时，自动提取对话上下文并生成结构化 Markdown 笔记
- 笔记通过 MCP `writeFile` 写入本地 `notes/` 目录
- 支持新建和追加两种模式
- 在对话中给出明确的成功/失败反馈

**Non-Goals:**
- 笔记管理 UI（列表、搜索、编辑）— 属于后续 librarian-agent
- 独立的笔记编辑器 — 超出本变更范围
- 跨书籍笔记聚合 — 后续考虑
- 笔记模板自定义 — 首版使用固定格式

## Decisions

### D1: 意图检测 — 正则匹配 vs LLM Function Calling

**选择：正则匹配**

在 `useChat.sendMessage` 入口处用正则检测用户消息是否包含记笔记意图关键词（"记笔记"/"做笔记"/"记一下"/"写笔记"/"note this"等）。

**理由：**
- 零延迟，不需要额外 LLM 调用来判断意图
- 关键词集合有限且可预测，正则足够可靠
- Function Calling 需要所有 provider（DeepSeek/Kimi/Moonshot）都支持，兼容性风险高
- 符合极简主义设计哲学

**备选（Function Calling）不选的原因：**
- 增加一次 LLM roundtrip（延迟 +1-3s）
- 并非所有 OpenAI Compatible 提供商都完美支持 function_call
- 过度工程化：用户说"记笔记"这类指令是高度明确的

### D2: 笔记生成 — 专用 System Prompt

**选择：复用现有 `window.electronAPI.llm.chat()` 通道，但使用专用笔记生成 system prompt**

当检测到记笔记意图后：
1. 从用户消息中提取主题（如果有），否则 LLM 自动总结
2. 构造专用 `noteSystemPrompt`，指导 LLM 生成结构化 Markdown
3. 调用 `llm.chat()`，传入最近 N 条对话 + 笔记 system prompt
4. 收集完整响应作为笔记内容（非流式展示给用户，因为笔记内容要完整写入文件）

**System Prompt 模板核心要素：**
- 角色：你是一个阅读笔记助手
- 输入：最近的对话上下文
- 输出格式：Markdown with `# 标题`、`## 要点`、`> 原文引用`、`### 感想`
- 约束：简洁、结构化、保留关键引用

### D3: 文件路径策略

**选择：`{bookshelfPath}/notes/{书名}-{YYYY-MM-DD}-{主题}.md`**

- `bookshelfPath`：从 Store 的 `bookshelfPath` 获取（MCP 已挂载的目录）
- `notes/` 子目录：固定目录名，首次写入前需确保目录存在
- `书名`：从 Store 的 `selectedBookId` 关联的 Book 对象获取 title，做 slug 处理
- `日期`：`YYYY-MM-DD` 格式
- `主题`：LLM 生成或用户指定，slug 处理（中文保留、去特殊字符）

**目录确保策略：** MCP filesystem server 的 `write_file` 在父目录不存在时行为不确定。需要先尝试写入，如果失败则通过 `create_directory` tool 创建 `notes/` 目录后重试。

### D4: 追加模式实现

**选择：读取 → 拼接 → 覆写**

MCP `writeFile` 只支持覆写。追加模式实现为：
1. 尝试 `readFile(path)` 获取现有内容
2. 如果文件存在，在现有内容尾部追加 `\n\n---\n\n` + 新内容
3. 调用 `writeFile(path, combinedContent)` 覆写

**触发条件：** 用户消息中包含"追加"/"补充"/"继续记"等关键词 + 最近一次笔记路径存在。

### D5: UI 反馈 — 系统消息

**选择：在对话中插入特殊类型的 assistant 消息**

- 成功：展示 NoteConfirmation 组件（绿色提示卡片），包含文件路径和笔记摘要
- 失败：展示错误消息（红色），包含失败原因
- 进行中：展示 "正在生成笔记..." 的 loading 状态

**消息类型扩展：** 在 Message 类型中新增可选字段 `metadata?: { type: 'note-confirmation', filePath: string, noteTitle: string }` 用于区分笔记消息和普通对话消息。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 正则误触发（如讨论"笔记"概念时被识别为指令） | 用户体验干扰 | 要求明确的动作词组合（"帮我记"/"记一下"），纯名词"笔记"不触发 |
| notes/ 目录创建失败 | 笔记无法写入 | 错误消息明确提示用户检查书架目录权限 |
| MCP 未连接时触发笔记 | 写入失败 | 检测 MCP 连接状态，未连接时提示用户先在设置中配置书架路径 |
| 追加模式的 read+write 非原子操作 | 并发写入可能丢数据 | 单用户桌面应用，实际并发风险极低；不做额外处理 |
| LLM 生成的笔记质量不可控 | 内容可能不符预期 | 在对话中展示笔记预览，后续可增加"修改后保存"功能 |
