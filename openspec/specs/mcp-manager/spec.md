## ADDED Requirements

### Requirement: McpManager 单例实例化
系统 SHALL 实现 McpManager 作为单例类,确保整个应用生命周期内仅存在一个 MCP Client 实例。

#### Scenario: 获取单例实例
- **WHEN** 任意模块调用 `McpManager.getInstance()`
- **THEN** 返回同一个 McpManager 实例
- **AND** 不允许通过 `new McpManager()` 直接实例化

#### Scenario: 多次获取实例
- **WHEN** 多个模块同时调用 `McpManager.getInstance()`
- **THEN** 所有调用返回相同的实例引用
- **AND** 实例状态在所有模块间共享

### Requirement: 本地 MCP Server 连接
系统 SHALL 通过 StdioClientTransport 启动并连接本地 filesystem MCP Server 子进程。

#### Scenario: 成功连接本地目录
- **WHEN** 调用 `connectLocal(path)` 且 path 为有效目录
- **THEN** 使用 npx 启动 @modelcontextprotocol/server-filesystem 子进程
- **AND** 通过 stdio 建立 JSON-RPC 通信
- **AND** 连接状态更新为 'connected'
- **AND** 返回成功的 Promise

#### Scenario: 路径不存在
- **WHEN** 调用 `connectLocal(path)` 且 path 不存在
- **THEN** 抛出 McpConnectionError 错误
- **AND** 错误 code 为 'SPAWN_FAILED'
- **AND** 连接状态保持 'disconnected'

#### Scenario: 已连接状态下重复调用
- **WHEN** 当前已处于 'connected' 状态,再次调用 `connectLocal(path)`
- **THEN** 如果 path 与当前路径相同,直接返回成功
- **AND** 如果 path 不同,先 disconnect 再连接新路径

### Requirement: 连接失败自动重试
系统 SHALL 在连接失败时自动重试,采用指数退避策略,最多重试 3 次。

#### Scenario: 首次连接失败触发重试
- **WHEN** MCP Server 子进程启动失败
- **THEN** 等待 2 秒后自动重试
- **AND** 重试时通过日志输出 "Retrying MCP connection (1/3)..."

#### Scenario: 第二次重试
- **WHEN** 第一次重试仍失败
- **THEN** 等待 4 秒后进行第二次重试
- **AND** 重试时通过日志输出 "Retrying MCP connection (2/3)..."

#### Scenario: 第三次重试
- **WHEN** 第二次重试仍失败
- **THEN** 等待 8 秒后进行第三次重试
- **AND** 重试时通过日志输出 "Retrying MCP connection (3/3)..."

#### Scenario: 所有重试耗尽
- **WHEN** 3 次重试全部失败
- **THEN** 抛出 McpConnectionError 错误
- **AND** 错误消息包含完整的失败原因
- **AND** retriesLeft 字段为 0

#### Scenario: 重试成功
- **WHEN** 第 2 次重试成功建立连接
- **THEN** 停止后续重试
- **AND** 连接状态更新为 'connected'
- **AND** 返回成功的 Promise

### Requirement: 断开连接与子进程清理
系统 SHALL 提供 disconnect() 方法,正确清理子进程和连接状态。

#### Scenario: 正常断开连接
- **WHEN** 调用 `disconnect()`
- **THEN** 向 MCP Server 发送关闭请求
- **AND** 调用 child_process.kill() 终止子进程
- **AND** 连接状态更新为 'disconnected'
- **AND** 清空内部 client 引用

#### Scenario: 重复调用 disconnect
- **WHEN** 当前已处于 'disconnected' 状态,再次调用 `disconnect()`
- **THEN** 直接返回,不执行任何操作
- **AND** 不抛出错误

#### Scenario: 主进程退出时自动清理
- **WHEN** Electron 主进程触发 'quit' 事件
- **THEN** 自动调用 disconnect()
- **AND** 确保子进程不会成为僵尸进程

### Requirement: 文件操作 - 列出目录
系统 SHALL 提供 listFiles(path) 方法,通过 MCP Tools 列出目录内容。

#### Scenario: 列出根目录文件
- **WHEN** 调用 `listFiles(mountedPath)`
- **THEN** 调用 MCP Tool 'list_directory' 且参数为 path
- **AND** 返回 FileEntry 数组
- **AND** 每个 FileEntry 包含 name, path, size, type, lastModified 字段

#### Scenario: 列出子目录文件
- **WHEN** 调用 `listFiles(mountedPath + '/子文件夹')`
- **THEN** 返回该子文件夹下的所有文件和子目录
- **AND** path 字段为相对于挂载点的路径

#### Scenario: 目录不存在
- **WHEN** 调用 `listFiles(invalidPath)`
- **THEN** 抛出错误,包含 "Directory not found" 信息
- **AND** 错误来源可追溯到 MCP Server 返回的错误

#### Scenario: 权限被拒绝
- **WHEN** 调用 `listFiles(path)` 但无读取权限
- **THEN** 抛出错误,包含 "Permission denied" 信息
- **AND** 原始 MCP 错误被包装为用户友好描述

### Requirement: 文件操作 - 读取文件
系统 SHALL 提供 readFile(path) 方法,通过 MCP Tools 读取文件内容。

#### Scenario: 读取文本文件
- **WHEN** 调用 `readFile('/Books/三体.txt')`
- **THEN** 调用 MCP Tool 'read_file' 且参数为 path
- **AND** 返回文件内容(string 或 ArrayBuffer)
- **AND** 内容编码由 MCP Server 处理

#### Scenario: 读取二进制文件
- **WHEN** 调用 `readFile('/Books/三体.epub')`
- **THEN** 返回 ArrayBuffer 类型的文件内容
- **AND** 调用者可直接传递给 epub.js 解析

#### Scenario: 文件不存在
- **WHEN** 调用 `readFile(invalidPath)`
- **THEN** 抛出错误,包含 "File not found" 信息

#### Scenario: 文件过大
- **WHEN** 调用 `readFile(largeFilePath)` 且文件大于 100MB
- **THEN** MCP Server 可能拒绝返回(根据 server 配置)
- **AND** 错误信息包含文件大小限制说明

### Requirement: 文件操作 - 写入文件
系统 SHALL 提供 writeFile(path, content) 方法,通过 MCP Tools 写入文件内容。

#### Scenario: 写入新文件
- **WHEN** 调用 `writeFile('/Notes/笔记.md', markdownContent)`
- **THEN** 调用 MCP Tool 'write_file' 且参数为 path 和 content
- **AND** 文件创建成功,内容为 markdownContent
- **AND** 返回成功的 Promise

#### Scenario: 覆盖已存在文件
- **WHEN** 调用 `writeFile(existingPath, newContent)`
- **THEN** 原文件内容被覆盖为 newContent
- **AND** 不需要显式删除原文件

#### Scenario: 目标目录不存在
- **WHEN** 调用 `writeFile('/NonExist/file.txt', content)`
- **THEN** MCP Server 根据配置决定是否自动创建父目录
- **AND** 如果禁止自动创建,抛出 "Directory not found" 错误

#### Scenario: 权限被拒绝
- **WHEN** 调用 `writeFile(path, content)` 但无写入权限
- **THEN** 抛出错误,包含 "Permission denied" 信息

### Requirement: 文件操作 - 移动文件
系统 SHALL 提供 moveFile(source, destination) 方法,通过 MCP Tools 移动或重命名文件。

#### Scenario: 重命名文件
- **WHEN** 调用 `moveFile('/Books/旧名.epub', '/Books/新名.epub')`
- **THEN** 调用 MCP Tool 'move_file' 且参数为 source 和 destination
- **AND** 文件重命名成功
- **AND** 原路径文件不再存在

#### Scenario: 移动文件到不同目录
- **WHEN** 调用 `moveFile('/Books/三体.epub', '/SciFi/三体.epub')`
- **THEN** 文件从 Books 目录移动到 SciFi 目录
- **AND** 保持文件名不变

#### Scenario: 目标文件已存在
- **WHEN** 调用 `moveFile(source, destination)` 且 destination 已存在
- **THEN** MCP Server 根据配置决定是否覆盖
- **AND** 如果禁止覆盖,抛出 "Destination exists" 错误

#### Scenario: 源文件不存在
- **WHEN** 调用 `moveFile(invalidSource, destination)`
- **THEN** 抛出错误,包含 "Source file not found" 信息

### Requirement: 错误处理与类型定义
系统 SHALL 定义自定义错误类型 McpConnectionError,并为所有方法提供完整的 TypeScript 类型。

#### Scenario: McpConnectionError 结构
- **WHEN** 连接失败抛出 McpConnectionError
- **THEN** 错误对象包含以下字段:
  - `message`: 用户友好的错误描述
  - `code`: 错误类型枚举('SPAWN_FAILED' | 'HANDSHAKE_TIMEOUT' | 'SERVER_CRASHED')
  - `retriesLeft`: 剩余重试次数(0-3)
- **AND** 继承自 Error 类

#### Scenario: TypeScript 类型推导
- **WHEN** 调用 `listFiles(path)`
- **THEN** TypeScript 编译器推导返回类型为 `Promise<FileEntry[]>`
- **AND** FileEntry 接口包含所有必需字段的类型定义

#### Scenario: 方法参数类型检查
- **WHEN** 调用 `connectLocal(123)` (类型错误)
- **THEN** TypeScript 编译时报错
- **AND** 提示 "Argument of type 'number' is not assignable to parameter of type 'string'"

#### Scenario: 错误类型守卫
- **WHEN** catch 块捕获错误
- **THEN** 可通过 `error instanceof McpConnectionError` 判断错误类型
- **AND** TypeScript 类型收窄为 McpConnectionError,可访问 code 和 retriesLeft

### Requirement: 连接状态管理
系统 SHALL 维护内部连接状态,并提供 getStatus() 方法查询当前状态。

#### Scenario: 初始状态
- **WHEN** 应用启动,McpManager 首次实例化
- **THEN** 连接状态为 'disconnected'
- **AND** currentPath 为 null

#### Scenario: 连接中状态
- **WHEN** 调用 `connectLocal(path)` 正在执行
- **THEN** 连接状态为 'connecting'
- **AND** currentPath 为请求的 path

#### Scenario: 已连接状态
- **WHEN** 连接成功建立
- **THEN** 连接状态为 'connected'
- **AND** currentPath 为已连接的路径

#### Scenario: 错误状态
- **WHEN** 连接失败且所有重试耗尽
- **THEN** 连接状态为 'error'
- **AND** lastError 字段包含错误信息

#### Scenario: 查询状态
- **WHEN** 调用 `getStatus()`
- **THEN** 返回对象包含:
  - `status`: 'disconnected' | 'connecting' | 'connected' | 'error'
  - `currentPath`: string | null
  - `lastError`: Error | null

### Requirement: 日志记录
系统 SHALL 通过 Electron log 记录所有关键操作和错误,便于调试和问题排查。

#### Scenario: 记录连接尝试
- **WHEN** 调用 `connectLocal(path)`
- **THEN** 输出日志: `[McpManager] Connecting to local path: ${path}`

#### Scenario: 记录重试
- **WHEN** 触发自动重试
- **THEN** 输出日志: `[McpManager] Retrying MCP connection (1/3)...`
- **AND** 包含上次失败的错误信息

#### Scenario: 记录成功连接
- **WHEN** 连接成功建立
- **THEN** 输出日志: `[McpManager] Successfully connected to ${path}`

#### Scenario: 记录文件操作
- **WHEN** 调用 `listFiles(path)`
- **THEN** 输出日志: `[McpManager] listFiles: ${path}`
- **AND** 操作完成后输出: `[McpManager] listFiles completed: ${fileCount} items`

#### Scenario: 记录错误
- **WHEN** 任何操作失败
- **THEN** 输出错误级别日志,包含:
  - 操作类型(connectLocal / listFiles / etc.)
  - 参数(path 等)
  - 完整错误堆栈
- **AND** 不包含敏感信息(如用户全路径真实用户名部分被脱敏)

#### Scenario: 记录子进程 stderr
- **WHEN** MCP Server 子进程输出到 stderr
- **THEN** 通过 Electron log 记录,前缀为 `[MCP Server]`
- **AND** 不中断主进程运行

### Requirement: 文件操作 - 创建目录
系统 SHALL 提供 `createDirectory(path: string)` 方法，通过 MCP Tools 创建新目录。

#### Scenario: 创建新目录
- **WHEN** 调用 `createDirectory('/Books/哲学')`
- **THEN** 调用 MCP Tool 'create_directory' 且参数为 path
- **AND** 目录创建成功
- **AND** 返回成功的 Promise

#### Scenario: 目录已存在
- **WHEN** 调用 `createDirectory(existingPath)` 且目录已存在
- **THEN** MCP Server 根据配置决定是否抛出错误或静默成功
- **AND** 如果抛出错误，包装为用户友好消息 "目录已存在"

#### Scenario: 父目录不存在
- **WHEN** 调用 `createDirectory('/NonExist/Sub/Dir')`
- **THEN** MCP Server 根据配置决定是否自动创建父目录
- **AND** 如果禁止自动创建，抛出 "Parent directory not found" 错误

#### Scenario: 权限被拒绝
- **WHEN** 调用 `createDirectory(path)` 但无写入权限
- **THEN** 抛出错误，包含 "Permission denied" 信息

### Requirement: 文件操作 - 删除文件
系统 SHALL 提供 `deleteFile(path: string)` 方法，通过 MCP Tools 删除文件。

#### Scenario: 删除已存在文件
- **WHEN** 调用 `deleteFile('/Books/三体.epub')`
- **THEN** 调用 MCP Tool 'delete_file' 且参数为 path
- **AND** 文件删除成功
- **AND** 文件不再存在于文件系统
- **AND** 返回成功的 Promise

#### Scenario: 文件不存在
- **WHEN** 调用 `deleteFile(invalidPath)` 且文件不存在
- **THEN** 抛出错误，包含 "File not found" 信息

#### Scenario: 权限被拒绝
- **WHEN** 调用 `deleteFile(path)` 但无删除权限
- **THEN** 抛出错误，包含 "Permission denied" 信息

#### Scenario: 删除目录（不支持）
- **WHEN** 调用 `deleteFile(directoryPath)` 且 path 指向目录而非文件
- **THEN** 抛出错误，消息为 "Cannot delete directory, use deleteDirectory instead"
- **AND** MCP Server 拒绝操作

### Requirement: 日志记录扩展
系统 SHALL 为新增的文件操作方法记录完整日志。

#### Scenario: 记录创建目录操作
- **WHEN** 调用 `createDirectory(path)`
- **THEN** 输出日志：`[McpManager] createDirectory: ${path}`
- **AND** 操作完成后输出：`[McpManager] createDirectory completed`

#### Scenario: 记录删除文件操作
- **WHEN** 调用 `deleteFile(path)`
- **THEN** 输出日志：`[McpManager] deleteFile: ${path}`
- **AND** 操作完成后输出：`[McpManager] deleteFile completed`

#### Scenario: 记录错误
- **WHEN** 操作失败
- **THEN** 输出错误级别日志，包含操作类型、参数、完整错误堆栈
- **AND** 不包含敏感信息
