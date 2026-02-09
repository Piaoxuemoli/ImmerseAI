## Why

当前 `persona-generator.ts` 是一个返回硬编码数据的 stub，不具备真实的角色分析能力。需要将其替换为基于 RAG 检索 + LLM 生成的真实实现，使用户能够根据书籍原文自动生成高质量的角色人设，完成 Phase 4 (灵魂) 的核心能力。

## What Changes

- 替换 `generatePersonaStub` 为真实的 `generatePersona` 函数，执行完整的 RAG→LLM 管道
- 新增并发三维度 RAG 检索（性格特征、经典台词、关键事件），合并去重后作为 LLM 上下文
- 新增 LLM Prompt 组装逻辑，要求返回符合 `GeneratedPersonaData` 接口的 JSON
- 通过 IPC `llm:chat` 调用主进程 LLM API，收集流式响应并解析 JSON
- 自动生成 `systemPrompt` 字段（基于宪法 4.3.4 定义的不可变模板）
- 新增错误处理：RAG 未索引、LLM 返回格式错误、网络失败等场景
- 更新 `usePersona` hook 的导入，从 stub 切换到真实函数

## Capabilities

### New Capabilities
- `persona-generation`: 真实的 RAG+LLM 角色人设生成管道，包括并发检索、Prompt 组装、流式响应收集、JSON 解析、systemPrompt 生成及错误处理

### Modified Capabilities
- `use-persona-hook`: 将 `generatePersonaStub` 导入替换为真实的 `generatePersona`，并适配可能的签名变更

## Impact

- **代码**: `src/features/chat/services/persona-generator.ts` 完全重写；`src/features/persona/hooks/usePersona.ts` 导入变更
- **依赖**: 无新外部依赖；使用现有 RAG Worker (`postMessage`) 和 IPC LLM API (`window.electronAPI.llm.chat`)
- **API**: `GeneratedPersonaData` 接口保持不变以保证向后兼容；新增 `generatePersona(bookId, characterName)` 替代 `generatePersonaStub`
- **系统**: RAG Worker 必须已完成书籍索引才能生成角色（未索引时抛出明确错误）
