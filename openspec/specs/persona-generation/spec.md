# PersonaGeneration 规范

## 目的
定义 RAG+LLM 角色人设生成管道的行为，包括并发检索、Prompt 组装、流式响应收集、JSON 解析、systemPrompt 生成及错误处理。

## Requirements

### Requirement: generatePersona 主函数
persona-generator 模块 SHALL 导出 `generatePersona(bookId: string, characterName: string, worker?: Worker): Promise<GeneratedPersonaData>` 函数，执行完整的 RAG 检索 + LLM 生成管道并返回角色数据。

#### Scenario: 成功生成角色
- **WHEN** 调用 `generatePersona(bookId, "章北海")` 且书籍已索引、LLM 可用
- **THEN** 返回符合 `GeneratedPersonaData` 接口的对象，包含 description、personality、speechStyle、background、keyQuotes 字段
- **AND** 所有字段均为非空字符串（keyQuotes 为非空数组）

#### Scenario: 书籍未索引
- **WHEN** 调用 `generatePersona(bookId, name)` 且该书籍尚未完成向量化索引
- **THEN** 抛出错误，错误消息包含 `BOOK_NOT_INDEXED`

### Requirement: 并发三维度 RAG 检索
persona-generator SHALL 使用 `Promise.all` 并发执行三个维度的语义检索，覆盖性格特征、经典台词、关键事件。

#### Scenario: 并发检索执行
- **WHEN** 执行 RAG 检索阶段
- **THEN** 同时发送三个 SearchMessage 到 Worker：
  - 查询 1：`"{name} 性格特征 性格 为人"` topK=5
  - 查询 2：`"{name} 台词 说话 名言"` topK=5
  - 查询 3：`"{name} 经历 事件 结局"` topK=5
- **AND** 等待所有三个查询完成

#### Scenario: 检索结果合并去重
- **WHEN** 三个搜索维度均返回结果
- **THEN** 合并所有结果并按 `text` 字段去重
- **AND** 过滤掉 score < 0.3 的低质量结果

#### Scenario: 检索结果为空
- **WHEN** 合并去重后有效结果为 0 条
- **THEN** 抛出错误，错误消息包含 `NO_RELEVANT_CONTENT`

### Requirement: Promise-based Worker 调用封装
persona-generator SHALL 提供 `searchRag` 辅助函数，将 Worker postMessage/onmessage 模式封装为 Promise。

#### Scenario: 正常搜索
- **WHEN** 调用 `searchRag(worker, bookId, query, topK)`
- **THEN** 向 worker 发送 `{ type: 'search', bookId, query, topK }` 消息
- **AND** 监听 worker 的 message 事件
- **AND** 当收到 `type: 'search:result'` 响应时 resolve 结果

#### Scenario: 搜索超时
- **WHEN** Worker 在 10 秒内未返回 `search:result` 响应
- **THEN** reject 并抛出 `RAG_TIMEOUT` 错误

#### Scenario: Worker 返回错误
- **WHEN** Worker 返回 `type: 'error'` 响应
- **THEN** reject 并包含 Worker 错误消息

### Requirement: LLM Prompt 组装
persona-generator SHALL 组装结构化 Prompt，要求 LLM 基于 RAG 上下文生成符合接口的 JSON。

#### Scenario: Prompt 结构
- **WHEN** 组装 LLM 消息
- **THEN** 生成包含 system 消息和 user 消息的 Message 数组：
  - system: 角色分析专家指令，要求只返回 JSON
  - user: 包含角色名称、RAG 检索到的原文片段、要求返回的 JSON 字段说明（description, personality, speechStyle, background, keyQuotes）

### Requirement: LLM 流式响应收集
persona-generator SHALL 通过 IPC `window.electronAPI.llm.chat` 调用 LLM 并收集完整响应。

#### Scenario: 收集流式响应
- **WHEN** 调用 LLM API
- **THEN** 使用 `window.electronAPI.llm.chat(messages, config)` 获取 ReadableStream
- **AND** 读取所有 chunk 拼接为完整字符串（遇到 `[DONE]` 停止）
- **AND** config 中设置 `temperature: 0.3` 以获得稳定 JSON 输出

#### Scenario: LLM 调用失败
- **WHEN** LLM API 返回错误或网络失败
- **THEN** 抛出错误，错误消息包含 `LLM_ERROR` 及原始错误详情

### Requirement: JSON 解析与校验
persona-generator SHALL 宽容解析 LLM 返回的 JSON，并校验字段完整性。

#### Scenario: 直接 JSON 解析成功
- **WHEN** LLM 返回内容为合法 JSON 字符串
- **THEN** 直接 `JSON.parse` 并提取 GeneratedPersonaData 字段

#### Scenario: 正则提取 JSON
- **WHEN** 直接 `JSON.parse` 失败
- **THEN** 使用正则 `/\{[\s\S]*\}/` 从响应中提取第一个 JSON 对象
- **AND** 重新尝试解析

#### Scenario: 解析彻底失败
- **WHEN** 直接解析和正则提取均失败
- **THEN** 抛出错误，错误消息包含 `PERSONA_PARSE_ERROR`

#### Scenario: 缺失字段容错
- **WHEN** JSON 解析成功但部分字段缺失
- **THEN** 缺失的字符串字段使用空字符串默认值
- **AND** 缺失的 keyQuotes 使用空数组默认值

### Requirement: systemPrompt 生成
persona-generator SHALL 基于宪法 4.3.4 定义的模板生成 systemPrompt。

#### Scenario: 生成 systemPrompt
- **WHEN** generatePersona 返回结果
- **THEN** 返回的 GeneratedPersonaData 中包含 `systemPrompt` 字段
- **AND** systemPrompt 使用 IMMERSIVE_SYSTEM_PROMPT 模板，插值 role_name、persona_background、persona_personality、persona_speech_style
- **AND** `{rag_context}` 占位符保留（对话时动态填充）

### Requirement: GeneratedPersonaData 接口兼容
persona-generator SHALL 保持 `GeneratedPersonaData` 接口不变，新增 `systemPrompt` 字段。

#### Scenario: 接口字段
- **WHEN** generatePersona 返回结果
- **THEN** 结果包含以下字段：description (string), personality (string), speechStyle (string), background (string), keyQuotes (string[]), systemPrompt (string)
