## 1. Worker 通信封装

- [x] 1.1 实现 `searchRag(worker, bookId, query, topK)` Promise 辅助函数，封装 postMessage/onmessage 模式，包含 10s 超时和 error 响应处理
- [x] 1.2 实现 `checkBookIndexed(worker, bookId)` 辅助函数，通过 StatusMessage 检查书籍索引状态

## 2. RAG 检索管道

- [x] 2.1 实现并发三维度检索函数 `fetchRagContext(worker, bookId, characterName)`：构造三个查询字符串，Promise.all 并发执行 searchRag
- [x] 2.2 实现结果合并去重逻辑：按 text 字段去重，过滤 score < 0.3 的结果
- [x] 2.3 实现空结果校验：有效结果为 0 条时抛出 NO_RELEVANT_CONTENT 错误

## 3. LLM Prompt 与调用

- [x] 3.1 定义 Prompt 模板常量：system 消息（角色分析专家指令，要求只返回 JSON）和 user 消息模板（包含角色名 + 原文片段 + JSON 字段说明）
- [x] 3.2 实现 `buildPromptMessages(characterName, contextChunks)` 函数，组装 Message[] 数组
- [x] 3.3 实现 `callLlm(messages)` 函数：调用 `window.electronAPI.llm.chat`，读取 ReadableStream 所有 chunk 拼接为完整字符串，遇到 [DONE] 停止

## 4. 响应解析

- [x] 4.1 实现 `parsePersonaJson(rawText)` 函数：先尝试直接 JSON.parse，失败则正则提取 /\{[\s\S]*\}/ 再解析，均失败抛出 PERSONA_PARSE_ERROR
- [x] 4.2 实现字段校验与默认值填充：确保 description, personality, speechStyle, background 为字符串，keyQuotes 为 string[]

## 5. systemPrompt 生成

- [x] 5.1 定义 IMMERSIVE_SYSTEM_PROMPT 模板常量（宪法 4.3.4 定义的不可变结构）
- [x] 5.2 实现 `buildSystemPrompt(name, persona)` 函数：模板字段插值，{rag_context} 保留占位符

## 6. 主函数与接口

- [x] 6.1 更新 GeneratedPersonaData 接口：新增 systemPrompt 字段
- [x] 6.2 实现 `generatePersona(bookId, characterName, worker?)` 主函数：串联索引检查 → RAG 检索 → Prompt 组装 → LLM 调用 → JSON 解析 → systemPrompt 生成 → 返回结果
- [x] 6.3 实现错误处理：捕获各阶段异常，分类为 BOOK_NOT_INDEXED / RAG_TIMEOUT / NO_RELEVANT_CONTENT / LLM_ERROR / PERSONA_PARSE_ERROR

## 7. usePersona Hook 更新

- [x] 7.1 将 `usePersona.ts` 中 `generatePersonaStub` 导入替换为 `generatePersona`
- [x] 7.2 调整 generatePersona 调用签名（传入 bookId, form.name.trim()）
- [x] 7.3 在 savePersona 中使用最近一次生成返回的 systemPrompt 填充 Persona.systemPrompt 字段

## 8. 验证

- [x] 8.1 TypeScript 编译通过 (`npx tsc --noEmit`)
- [x] 8.2 删除旧的 generatePersonaStub 函数，确认无残留引用
