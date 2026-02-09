## ADDED Requirements

### Requirement: Worker 崩溃检测与自动重启
系统 SHALL 在持有 RAG Worker 的层（如 useRagWorker）检测 Worker 崩溃，并在同一会话内自动重启最多 3 次；超过后不再重启并提示用户。

#### Scenario: 崩溃检测
- **WHEN** Worker 触发 `error` 事件或异常退出（非用户主动 terminate）
- **THEN** 持有层 SHALL 将当前 Worker 视为不可用并进入恢复流程

#### Scenario: 自动重启
- **WHEN** 检测到崩溃且当前会话内重启次数小于 3
- **THEN** 系统 SHALL 丢弃旧 Worker 引用并创建新 Worker 实例（`new Worker(...)`）
- **AND** 重新初始化通信与状态
- **AND** 将「当前会话内重启次数」加 1

#### Scenario: 达到最大重启次数
- **WHEN** 检测到崩溃且当前会话内重启次数已为 3
- **THEN** 系统 SHALL 不再自动重启
- **AND** 通过 Toast 或等价方式提示用户「RAG 服务暂时不可用，请刷新页面重试」

#### Scenario: 重启次数重置
- **WHEN** 用户刷新页面或重新加载应用
- **THEN** 重启次数 SHALL 重置为 0，下次崩溃可再次执行最多 3 次自动重启
