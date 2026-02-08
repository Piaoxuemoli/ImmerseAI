## MODIFIED Requirements

### Requirement: contextBridge IPC 接口
系统 SHALL 在 electron/preload/index.ts 通过 contextBridge.exposeInMainWorld 暴露安全的 IPC 接口。

#### Scenario: IPC 接口暴露
- **WHEN** preload 脚本执行
- **THEN** 在 window 对象上创建 electronAPI 命名空间
- **AND** 所有 IPC 方法通过 ipcRenderer.invoke 调用

#### Scenario: 类型安全接口
- **WHEN** 渲染进程访问 window.electronAPI
- **THEN** TypeScript 能正确推断所有方法的类型签名
- **AND** 参数和返回值类型与主进程 IPC handler 一致
- **AND** 所有类型必须从 `@/shared/types/index.ts` 导入，禁止使用 `unknown` 或 `any`
- **AND** electron/preload/index.ts 和 electron/main/ipc-handlers.ts 的类型签名必须完全一致

#### Scenario: 全局类型声明
- **WHEN** 渲染进程代码引用 window.electronAPI
- **THEN** src/shared/types/electron.d.ts 中的 ElectronAPI 接口定义必须与 preload 实现一致
- **AND** TypeScript 编译器能在编译时检测所有类型不匹配

### Requirement: MCP 文件操作接口
系统 SHALL 暴露 MCP 相关的文件操作 IPC 接口。

#### Scenario: 列出文件
- **WHEN** 渲染进程调用 window.electronAPI.mcp.listFiles(path)
- **THEN** 主进程通过 MCP Server 列出目录内容
- **AND** 返回 BookFile[] 类型的文件列表
- **AND** BookFile 类型必须从 `@/shared/types/index.ts` 导入

#### Scenario: 读取文件
- **WHEN** 渲染进程调用 window.electronAPI.mcp.readFile(path)
- **THEN** 主进程通过 MCP Server 读取文件内容
- **AND** 返回 ArrayBuffer 类型的文件数据
- **AND** 参数 path 必须显式声明为 string 类型

#### Scenario: 写入文件
- **WHEN** 渲染进程调用 window.electronAPI.mcp.writeFile(path, content)
- **THEN** 主进程通过 MCP Server 写入文件
- **AND** 返回 void 表示成功
- **AND** 参数类型必须显式声明为 (path: string, content: string)

#### Scenario: 移动文件
- **WHEN** 渲染进程调用 window.electronAPI.mcp.moveFile(source, dest)
- **THEN** 主进程通过 MCP Server 移动文件
- **AND** 返回 void 表示成功
- **AND** 参数类型必须显式声明为 (source: string, dest: string)

### Requirement: LLM API 接口
preload 脚本 SHALL 通过 `contextBridge` 暴露 `window.electronAPI.llm.chat()` 方法，该方法返回 `ReadableStream<string>` 用于接收流式 LLM 响应，并处理流中错误事件。

#### Scenario: 流式聊天
- **WHEN** 渲染进程调用 window.electronAPI.llm.chat(messages, config)
- **THEN** 主进程调用 LLM API 并建立流式连接
- **AND** 返回 ReadableStream<string> 类型的流式响应
- **AND** messages 参数类型必须为 Message[]，从 `@/shared/types/index.ts` 导入
- **AND** config 参数类型必须为 LlmConfig，定义于 `@/shared/types/index.ts`
- **AND** LlmConfig 接口必须包含 provider、model、temperature、maxTokens、stream 字段

#### Scenario: LlmConfig 类型定义
- **WHEN** 系统定义 LlmConfig 接口
- **THEN** 接口必须包含以下字段：
  - `provider?: 'deepseek' | 'kimi' | 'moonshot' | 'openai' | 'custom'`
  - `model?: string`
  - `temperature?: number` (范围 0.0-1.0)
  - `maxTokens?: number`
  - `stream?: boolean` (默认 true)
- **AND** 所有字段必须为可选，支持默认值合并

#### Scenario: 正常流式接收
- **WHEN** 渲染进程调用 `window.electronAPI.llm.chat(messages, config)`
- **THEN** 返回一个 `ReadableStream<string>`
- **AND** 对每个通过 `llm:chat-chunk` IPC event 接收到的 chunk 执行 `controller.enqueue(chunk)`
- **AND** 当收到 `'[DONE]'` 时执行 `controller.close()`

#### Scenario: 流中错误处理
- **WHEN** 主进程通过 `event.sender.send('llm:chat-error', errorPayload)` 发送错误
- **THEN** preload 脚本中注册的 `ipcRenderer.on('llm:chat-error', ...)` 监听器被触发
- **AND** 监听器调用 `controller.error(new Error(errorPayload.message))` 终止 ReadableStream
- **AND** 渲染进程可通过 ReadableStream 的 `.catch()` 或 `try/catch` 在 reader 层捕获此错误

#### Scenario: 事件监听器清理
- **WHEN** ReadableStream 完成（`[DONE]`）或出错（`llm:chat-error`）
- **THEN** preload 脚本 SHALL 在 `cancel()` 回调和正常结束路径中移除 `llm:chat-chunk` 和 `llm:chat-error` 两个监听器
- **AND** 避免因监听器泄漏导致的内存问题

### Requirement: 应用工具接口
系统 SHALL 暴露应用级别的工具方法。

#### Scenario: 选择目录
- **WHEN** 渲染进程调用 window.electronAPI.app.selectDirectory()
- **THEN** 主进程打开系统文件选择对话框
- **AND** 返回用户选择的目录路径（string | null）
- **AND** 返回类型必须显式声明为 Promise<string | null>

#### Scenario: 安全存储读取
- **WHEN** 渲染进程调用 window.electronAPI.app.getSafeStorage(key)
- **THEN** 主进程从 Electron safeStorage 读取加密数据
- **AND** 返回解密后的字符串类型 Promise<string>
- **AND** key 参数类型必须显式声明为 string

#### Scenario: 安全存储写入
- **WHEN** 渲染进程调用 window.electronAPI.app.setSafeStorage(key, value)
- **THEN** 通过 `ipcRenderer.invoke('app:set-safe-storage', { key, value })` 调用主进程
- **AND** 返回 `Promise<boolean>`（成功为 `true`，失败为 `false`）
- **AND** 参数类型必须显式声明为 (key: string, value: string)

### Requirement: 主进程 Handler 类型注解
系统 SHALL 在所有 ipcMain.handle 函数中添加显式的参数和返回值类型注解。

#### Scenario: Handler 函数签名
- **WHEN** 注册 ipcMain.handle
- **THEN** 函数参数必须包含类型注解（如 `path: string`）
- **AND** 函数返回值必须包含类型注解（如 `Promise<BookFile[]>`）
- **AND** 类型必须与 preload 中对应方法的签名完全一致

#### Scenario: 类型导入一致性
- **WHEN** main/ipc-handlers.ts 中声明类型
- **THEN** 必须从 `@/shared/types/index.ts` 导入相同的类型定义
- **AND** 不得在 main 或 preload 中重复定义领域类型

## ADDED Requirements

### Requirement: TypeScript 编译检查
系统 SHALL 在构建和开发过程中进行类型检查，确保 IPC 接口类型一致性。

#### Scenario: 编译时检查
- **WHEN** 运行 `npx tsc --noEmit`
- **THEN** 必须检测 preload 和 main 之间的类型不匹配
- **AND** 必须检测渲染进程中错误的 window.electronAPI 调用
- **AND** 必须识别所有使用 unknown 或 any 的违规代码

#### Scenario: IntelliSense 支持
- **WHEN** 开发者在渲染进程中输入 `window.electronAPI.`
- **THEN** IDE 必须显示所有可用的方法及其类型签名
- **AND** 参数输入时必须提供类型提示和自动补全
- **AND** 返回值必须正确推断类型，无需手动注解

### Requirement: IPC 白名单限制
系统 SHALL 仅暴露预定义的 IPC channel，禁止动态 channel 或通配符。

#### Scenario: 允许的 on 事件通道
- **THEN** 允许的 IPC on 事件通道 SHALL 包含：
  - `llm:chat-chunk`
  - `llm:chat-error`
- **AND** 其他未列出的 on 通道 SHALL 被拒绝

#### Scenario: 非法 channel 拦截
- **WHEN** 渲染进程尝试调用未在 preload 中暴露的 channel
- **THEN** ipcRenderer 拒绝执行
- **AND** 不泄露任何主进程信息
