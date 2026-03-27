## Context

当前 `persona-generator.ts` 是一个 stub，返回硬编码数据。项目已具备完整的 RAG 引擎（Web Worker 中运行 Transformers.js + Orama）和 LLM 流式调用通道（IPC `llm:chat` → 主进程 OpenAI SDK）。本次设计将这两个基础设施串联，实现从"书籍原文"到"角色人设"的完整生成管道。

约束条件：
- 核心原则 P-2：所有 RAG 检索必须通过 Web Worker `postMessage`，不在渲染进程执行
- 核心原则 P-1：书籍内容仅在本地处理，仅 LLM API 调用产生出站流量
- `GeneratedPersonaData` 接口不可变更（向后兼容）
- LLM 流式响应通过 `event.sender.send('llm:chat-chunk')` 逐 chunk 推送，最后发送 `[DONE]`

## Goals / Non-Goals

**Goals:**
- 将 stub 替换为真实的 RAG+LLM 角色生成管道
- 并发执行多维度语义检索，最大化上下文质量
- 生成包含 systemPrompt 的完整角色数据
- 覆盖所有合理的失败场景并提供明确错误消息

**Non-Goals:**
- 不实现 RAG Worker 本身的修改（现有 search 接口已满足需求）
- 不实现流式打字机效果展示（该功能属于 chat-streaming，此处仅收集完整响应）
- 不实现角色头像生成
- 不修改 LLM Handler 或 IPC 通道

## Decisions

### D1: RAG 通信方式 — 封装 Promise-based Worker 调用

**选择**: 在 `persona-generator.ts` 中封装一个 `searchRag(bookId, query, topK)` 辅助函数，通过 `worker.postMessage` 发送 `SearchMessage`，监听 `message` 事件并按 `type === 'search:result'` 解析返回值，包装为 Promise。

**替代方案**: 直接在每个调用点手写 postMessage + onmessage。  
**理由**: Promise 封装更适合 async/await 管道，避免回调地狱，且可复用于三次并发调用。

### D2: 并发检索策略 — Promise.all 三维度查询

**选择**: 使用 `Promise.all` 并发执行三个搜索维度：
1. `"{name} 性格特征 性格 为人"` — topK=5
2. `"{name} 台词 说话 名言"` — topK=5
3. `"{name} 经历 事件 结局"` — topK=5

合计最多 15 条结果，按 `text` 去重后作为 LLM 上下文。

**替代方案**: 单次查询 `"{name}"` topK=15。  
**理由**: 多维度查询覆盖面更广，避免所有结果集中在单一维度。

### D3: LLM 调用方式 — 非流式收集全量响应

**选择**: 调用 `window.electronAPI.llm.chat(messages, config)` 获取 ReadableStream，读取所有 chunk 拼接为完整字符串，然后解析 JSON。不使用流式 UI 展示。

**替代方案**: 使用独立的非流式 IPC 通道。  
**理由**: 复用现有 IPC 基础设施，角色生成是一次性操作无需实时展示中间结果。LLM config 中设置 `temperature: 0.3` 以获得更稳定的 JSON 输出。

### D4: JSON 解析策略 — 宽容提取

**选择**: 先尝试直接 `JSON.parse`；若失败，使用正则 `/\{[\s\S]*\}/` 从响应中提取第一个 JSON 对象再解析。对缺失字段提供默认值。

**替代方案**: 严格要求 LLM 只返回 JSON。  
**理由**: LLM 可能在 JSON 前后添加解释文本或 markdown 代码块标记，宽容提取更健壮。

### D5: systemPrompt 生成 — 硬编码模板 + 字段插值

**选择**: 在 `persona-generator.ts` 中定义宪法 4.3.4 的 `IMMERSIVE_SYSTEM_PROMPT` 模板，使用生成的角色数据进行字段插值。`{rag_context}` 占位符在实际对话时动态填充，生成阶段留空或填入示例上下文。

**替代方案**: 让 LLM 生成整个 systemPrompt。  
**理由**: 宪法要求模板结构不可修改，仅数据字段可注入。

### D6: Worker 实例获取 — 通过全局单例或参数注入

**选择**: `generatePersona` 接受可选的 `worker: Worker` 参数。调用方 (usePersona) 管理 Worker 实例的创建/复用，通过参数传入。若不传入则在函数内部创建临时 Worker。

**替代方案**: 在 persona-generator 内部维护 Worker 单例。  
**理由**: Worker 生命周期应由上层管理，避免 service 层持有全局状态。同时提供内部降级创建，保证独立可用。

## Risks / Trade-offs

- **[LLM 返回非法 JSON]** → 宽容解析 (D4) + 明确的 `PERSONA_PARSE_ERROR` 错误码。Prompt 中强调 "只返回 JSON"。
- **[RAG 未索引]** → 调用前检查 Worker status，未索引时抛出 `BOOK_NOT_INDEXED` 错误，由 UI 层提示用户先打开书籍完成索引。
- **[Worker 不可用]** → postMessage 超时 (10s)，超时后抛出 `RAG_TIMEOUT` 错误。
- **[API Key 未配置]** → IPC 层已处理 `API_KEY_NOT_CONFIGURED`，persona-generator 层捕获并转为用户友好提示。
- **[并发检索质量]** → 如果书中未提及该角色名，三个查询都会返回低分结果。设置 score 阈值 (0.3)，低于阈值的结果不纳入上下文，上下文为空时提示用户"未找到角色相关内容"。
