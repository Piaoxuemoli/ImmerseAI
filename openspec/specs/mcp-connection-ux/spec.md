## Requirements

### Requirement: MCP 连接断开检测
系统 SHALL 在关键 MCP 调用失败且当前连接状态为已连接时，将连接状态更新为错误并可供 UI 消费。

#### Scenario: 调用失败时更新状态
- **WHEN** 在 `connectionStatus === 'connected'` 状态下调用 MCP 方法（如 listFiles、readFile）
- **AND** 该调用因连接断开或服务不可用而 reject
- **THEN** 调用方（如 useBookshelf）SHALL 将 Store 的 `connectionStatus` 设为 `'error'`
- **AND** 将可读错误信息写入本地 error 状态或 Store，供 UI 展示

#### Scenario: 复用现有状态
- **WHEN** 实现断开检测与提示
- **THEN** 系统 SHALL 复用现有 Store 的 `connectionStatus`（如 `'disconnected'`、`'connecting'`、`'connected'`、`'error'`）
- **AND** 不新增新的全局状态字段（仅使用现有 setConnectionStatus / setError 等）

### Requirement: MCP 断开重连提示
系统 SHALL 在检测到 MCP 连接断开（connectionStatus 变为 error 或已知断开）时向用户展示可操作提示。

#### Scenario: 提示方式
- **WHEN** `connectionStatus === 'error'` 且由 MCP 调用失败导致
- **THEN** 系统 SHALL 通过 Toast 或书架页内联错误区域展示提示
- **AND** 提示文案 SHALL 说明书架连接已断开，并引导用户重新选择目录或重连（如「请重新选择书架目录」）

#### Scenario: 不自动重连
- **WHEN** 检测到连接断开
- **THEN** 系统 SHALL 仅提示用户，不在此能力内实现自动重连
- **AND** 用户通过已有入口（如「选择目录」、设置页更换路径）主动重连
