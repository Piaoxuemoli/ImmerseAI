## ADDED Requirements

### Requirement: MCP 连接生命周期接口
系统 SHALL 在 `ElectronAPI.mcp` 上暴露连接管理方法，并在主进程注册对应 IPC handlers，委托 McpManager。

#### Scenario: connect 暴露与调用
- **WHEN** 渲染进程调用 `window.electronAPI.mcp.connect(path: string)`
- **THEN** preload SHALL 通过 `ipcRenderer.invoke('mcp:connect', path)` 调用主进程
- **AND** 主进程 handler SHALL 调用 `McpManager.getInstance().connectLocal(path)`
- **AND** 返回 `Promise<void>`，连接失败时 reject 并携带可读错误信息

#### Scenario: disconnect 暴露与调用
- **WHEN** 渲染进程调用 `window.electronAPI.mcp.disconnect()`
- **THEN** preload SHALL 通过 `ipcRenderer.invoke('mcp:disconnect')` 调用主进程
- **AND** 主进程 handler SHALL 调用 `McpManager.getInstance().disconnect()`
- **AND** 返回 `Promise<void>`

#### Scenario: getStatus 暴露与调用
- **WHEN** 渲染进程调用 `window.electronAPI.mcp.getStatus()`
- **THEN** preload SHALL 通过 `ipcRenderer.invoke('mcp:get-status')` 调用主进程
- **AND** 主进程 handler SHALL 调用 `McpManager.getInstance().getStatus()`
- **AND** 返回 `Promise<{ status: string; currentPath: string | null }>`（与 McpStatus 字段对齐，类型在 electron.d.ts 中声明）

#### Scenario: 类型声明同步
- **WHEN** 渲染进程或 IDE 引用 `window.electronAPI.mcp`
- **THEN** `src/shared/types/electron.d.ts` 中 `ElectronAPI.mcp` SHALL 包含 `connect(path: string): Promise<void>`、`disconnect(): Promise<void>`、`getStatus(): Promise<{ status: string; currentPath: string | null }>` 的方法签名
- **AND** 与 preload 实现及主进程 handler 返回值类型一致

#### Scenario: MCP Handler 错误处理
- **WHEN** 主进程任意 MCP 相关 handler（含 mcp:connect、mcp:disconnect、mcp:get-status、mcp:list-files、mcp:read-file 等）执行中抛出错误
- **THEN** handler SHALL 使用 try-catch 捕获
- **AND** 若为 McpConnectionError，将 code、message、retriesLeft 等序列化为可读信息通过 Promise.reject 返回
- **AND** 其它 Error 包装为包含 message 的可读错误返回给渲染进程，不导致主进程未捕获异常
