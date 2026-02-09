## Requirements

### Requirement: Worker 崩溃检测
系统 SHALL 在持有 RAG Worker 实例的层（如 useRagWorker 或等价封装）检测 Worker 的异常退出与错误事件。

#### Scenario: 检测 Worker error 事件
- **WHEN** Worker 内部发生未捕获错误并触发 `error` 事件
- **THEN** 持有层 SHALL 监听该事件并将当前 Worker 视为不可用
- **AND** 触发崩溃恢复流程（见「自动重启」）

#### Scenario: 检测 Worker 退出
- **WHEN** Worker 因异常或 `terminate` 而退出（如通过 `onmessage` 不可达或心跳超时推断）
- **THEN** 持有层 SHALL 将当前 Worker 视为已崩溃/已退出
- **AND** 若退出非用户主动终止，触发崩溃恢复流程

### Requirement: Worker 自动重启
系统 SHALL 在检测到 Worker 崩溃后自动重新创建 Worker 实例并重新初始化，同一会话内最多重启 3 次。

#### Scenario: 首次重启
- **WHEN** 检测到 Worker 崩溃且当前会话内重启次数为 0
- **THEN** 系统 SHALL 销毁或丢弃旧 Worker 引用
- **AND** 通过 `new Worker(...)` 创建新实例并重新初始化
- **AND** 将「当前会话内重启次数」加 1

#### Scenario: 达到最大重启次数
- **WHEN** 检测到 Worker 崩溃且当前会话内重启次数已为 3
- **THEN** 系统 SHALL 不再自动重启
- **AND** 触发用户提示（见「失败提示」），建议用户刷新页面重试

#### Scenario: 重启次数重置
- **WHEN** 用户刷新页面或重新加载应用
- **THEN** 「当前会话内重启次数」SHALL 重置为 0
- **AND** 下次崩溃可再次执行最多 3 次自动重启

### Requirement: Worker 崩溃失败提示
系统 SHALL 在自动重启次数用尽后向用户展示明确提示。

#### Scenario: 提示内容
- **WHEN** 达到最大重启次数（3 次）后不再重启
- **THEN** 系统 SHALL 通过 Toast 或内联方式提示用户
- **AND** 提示文案 SHALL 说明 RAG 服务暂时不可用，并建议刷新页面重试（或等价操作）
