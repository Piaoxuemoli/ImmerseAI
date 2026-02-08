# 系统架构规范

## 目的
定义 ImmerseAI 的进程架构、通信协议和模块边界。

## 需求

### Requirement: 双进程 + Worker 架构
系统 SHALL 采用 Electron 双进程架构（Main Process + Renderer Process），
并使用 Web Worker 作为独立计算线程。

#### Scenario: 计算密集型操作
- GIVEN 用户触发书籍索引操作
- WHEN 系统执行文本切分和向量化
- THEN 所有计算在 Web Worker 中执行，渲染进程 UI 帧率保持 60fps

### Requirement: IPC 安全通信
系统 SHALL 通过 preload.ts 的 contextBridge 暴露 IPC 接口。
渲染进程 SHALL NOT 直接访问 Node.js API。
nodeIntegration SHALL 设为 false，contextIsolation SHALL 设为 true。

#### Scenario: 渲染进程调用文件操作
- WHEN 渲染进程需要列出文件
- THEN 通过 window.electronAPI.listFiles() 调用
- AND 该方法由 preload.ts 中的 contextBridge.exposeInMainWorld 定义

### Requirement: MCP Sidecar 模式
MCP Server SHALL 作为 Electron 主进程的子进程运行。
通信 SHALL 使用 Stdio (Standard I/O) 传输协议。

#### Scenario: 启动 MCP 连接
- WHEN 用户挂载本地书架目录
- THEN 主进程 spawn MCP Server 子进程
- AND 通过 StdioClientTransport 建立 JSON-RPC 通信
