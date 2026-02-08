## MODIFIED Requirements

### Requirement: 双进程 + Worker 架构
系统 SHALL 采用 Electron 双进程架构（Main Process + Renderer Process），
并使用 Web Worker 作为独立计算线程。

构建配置 SHALL 使用 electron-vite 统一管理主进程、渲染进程和 Worker 的打包。

#### Scenario: 计算密集型操作
- GIVEN 用户触发书籍索引操作
- WHEN 系统执行文本切分和向量化
- THEN 所有计算在 Web Worker 中执行，渲染进程 UI 帧率保持 60fps

#### Scenario: Vite 开发服务器
- WHEN 开发者运行 `npm run dev`
- THEN electron-vite 启动主进程和渲染进程的 Vite 开发服务器
- AND 主进程和渲染进程都支持热模块替换（HMR）

#### Scenario: Worker 脚本打包
- WHEN 渲染进程加载 Web Worker
- THEN Vite 将 Worker 脚本打包为独立 chunk
- AND Worker 支持 ES Module import 语法

### Requirement: IPC 安全通信
系统 SHALL 通过 preload.ts 的 contextBridge 暴露 IPC 接口。
渲染进程 SHALL NOT 直接访问 Node.js API。
nodeIntegration SHALL 设为 false，contextIsolation SHALL 设为 true。

IPC 接口 SHALL 包括：
- MCP 文件操作（listFiles, readFile, writeFile, moveFile）
- LLM 聊天（llmChat，支持流式响应）
- 应用工具（selectDirectory, getSafeStorage, setSafeStorage）

#### Scenario: 渲染进程调用文件操作
- WHEN 渲染进程需要列出文件
- THEN 通过 window.electronAPI.listFiles() 调用
- AND 该方法由 preload.ts 中的 contextBridge.exposeInMainWorld 定义

#### Scenario: IPC 类型安全
- WHEN 渲染进程访问 window.electronAPI
- THEN TypeScript 能正确推断所有方法的类型签名
- AND 参数和返回值类型与主进程 IPC handler 一致

#### Scenario: IPC 白名单
- WHEN 渲染进程尝试调用未暴露的 IPC channel
- THEN ipcRenderer 拒绝执行
- AND 不泄露任何主进程信息

### Requirement: MCP Sidecar 模式
MCP Server SHALL 作为 Electron 主进程的子进程运行。
通信 SHALL 使用 Stdio (Standard I/O) 传输协议。

#### Scenario: 启动 MCP 连接
- WHEN 用户挂载本地书架目录
- THEN 主进程 spawn MCP Server 子进程
- AND 通过 StdioClientTransport 建立 JSON-RPC 通信

## ADDED Requirements

### Requirement: Cross-Origin Isolation 支持
系统 SHALL 在主进程配置响应头，启用 Cross-Origin Isolation 以支持 SharedArrayBuffer。

#### Scenario: 响应头注入
- WHEN 渲染进程请求本地资源
- THEN 主进程通过 webRequest.onHeadersReceived 拦截
- AND 添加 Cross-Origin-Opener-Policy: same-origin
- AND 添加 Cross-Origin-Embedder-Policy: require-corp

#### Scenario: Transformers.js 模型加载
- WHEN Web Worker 中加载 Transformers.js 模型
- THEN SharedArrayBuffer 可用（crossOriginIsolated === true）
- AND WASM 模块正常执行

### Requirement: TypeScript 严格模式
系统 SHALL 启用 TypeScript strict mode，分离主进程和渲染进程的 TypeScript 配置。

#### Scenario: 主进程类型检查
- WHEN TypeScript 编译主进程代码
- THEN 使用 tsconfig.node.json 配置
- AND 引入 Node.js 和 Electron 类型定义

#### Scenario: 渲染进程类型检查
- WHEN TypeScript 编译渲染进程代码
- THEN 使用 tsconfig.json 配置
- AND 引入 DOM 和 React 类型定义

#### Scenario: 禁止 any 类型
- WHEN 开发者编写代码
- THEN TypeScript 编译器拒绝 any 类型
- AND 强制使用明确类型或 unknown + 类型守卫
