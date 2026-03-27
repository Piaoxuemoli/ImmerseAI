## Requirements

### Requirement: 全局 Toast 错误展示
系统 SHALL 使用 shadcn/ui 的 Toast 组件（或项目采纳的等价方案）展示全局与关键错误通知。

#### Scenario: Toast 组件挂载
- **WHEN** 应用根布局或入口渲染
- **THEN** 系统 SHALL 在根组件树中挂载 Toaster（或等价 Provider）
- **AND** 所有页面均可通过统一 API（如 `toast.error(message)`）触发 Toast

#### Scenario: 错误 Toast 触发场景
- **WHEN** 以下任一情况发生且需向用户展示错误
- **THEN** 系统 SHALL 调用 Toast API 展示错误通知（建议使用 error 变体）：
  - Error Boundary 捕获到渲染错误（降级 UI 外可选再 toaster 提示）
  - RAG Worker 自动重启次数用尽
  - MCP 连接断开（connectionStatus 变为 error）
  - LLM 调用失败并收到 `llm:chat-error`（如 invalid_key、rate_limited、network_error）
- **AND** Toast 文案 SHALL 使用主进程或前端产出的用户可读 message

#### Scenario: 与内联错误并存
- **WHEN** 某处已有内联错误状态（如 useBookshelf 的 error、设置页测试连接失败）
- **THEN** 系统可同时保留内联展示与 Toast；关键、跨组件的错误 SHALL 至少通过 Toast 或内联之一展示
- **AND** 不强制所有错误仅 Toast，避免重复打扰时可仅内联

#### Scenario: 使用 shadcn/ui
- **WHEN** 实现 Toast 能力
- **THEN** 系统 SHALL 使用 shadcn/ui 文档中的 Toast 方案（如 Sonner 或 Radix Toast）
- **AND** 样式与现有 shadcn 组件一致
