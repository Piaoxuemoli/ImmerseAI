## ADDED Requirements

### Requirement: contextBridge IPC 接口
系统 SHALL 在 electron/preload/index.ts 通过 contextBridge.exposeInMainWorld 暴露安全的 IPC 接口。

#### Scenario: IPC 接口暴露
- WHEN preload 脚本执行
- THEN 在 window 对象上创建 electronAPI 命名空间
- AND 所有 IPC 方法通过 ipcRenderer.invoke 调用

#### Scenario: 类型安全接口
- WHEN 渲染进程访问 window.electronAPI
- THEN TypeScript 能正确推断所有方法的类型签名
- AND 参数和返回值类型与主进程 IPC handler 一致

### Requirement: MCP 文件操作接口
系统 SHALL 暴露 MCP 相关的文件操作 IPC 接口。

#### Scenario: 列出文件
- WHEN 渲染进程调用 window.electronAPI.listFiles(path)
- THEN 主进程通过 MCP Server 列出目录内容
- AND 返回 BookFile[] 类型的文件列表

#### Scenario: 读取文件
- WHEN 渲染进程调用 window.electronAPI.readFile(path)
- THEN 主进程通过 MCP Server 读取文件内容
- AND 返回 ArrayBuffer 类型的文件数据

#### Scenario: 写入文件
- WHEN 渲染进程调用 window.electronAPI.writeFile(path, content)
- THEN 主进程通过 MCP Server 写入文件
- AND 返回 void 表示成功

#### Scenario: 移动文件
- WHEN 渲染进程调用 window.electronAPI.moveFile(source, dest)
- THEN 主进程通过 MCP Server 移动文件
- AND 返回 void 表示成功

### Requirement: LLM API 接口
系统 SHALL 暴露 LLM 聊天 API 的 IPC 接口，支持流式响应。

#### Scenario: 流式聊天
- WHEN 渲染进程调用 window.electronAPI.llmChat(messages, config)
- THEN 主进程调用 LLM API 并建立流式连接
- AND 返回 ReadableStream 逐 chunk 传输响应

### Requirement: 应用工具接口
系统 SHALL 暴露应用级别的工具方法。

#### Scenario: 选择目录
- WHEN 渲染进程调用 window.electronAPI.selectDirectory()
- THEN 主进程打开系统文件选择对话框
- AND 返回用户选择的目录路径（string | null）

#### Scenario: 安全存储读取
- WHEN 渲染进程调用 window.electronAPI.getSafeStorage(key)
- THEN 主进程从 Electron safeStorage 读取加密数据
- AND 返回解密后的字符串

#### Scenario: 安全存储写入
- WHEN 渲染进程调用 window.electronAPI.setSafeStorage(key, value)
- THEN 主进程将数据加密存入 Electron safeStorage
- AND 返回 void 表示成功

### Requirement: IPC 白名单限制
系统 SHALL 仅暴露预定义的 IPC channel，禁止动态 channel 或通配符。

#### Scenario: 非法 channel 拦截
- WHEN 渲染进程尝试调用未在 preload 中暴露的 channel
- THEN ipcRenderer 拒绝执行
- AND 不泄露任何主进程信息
