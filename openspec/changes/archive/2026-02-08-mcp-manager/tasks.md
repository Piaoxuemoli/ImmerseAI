## 1. 项目结构与依赖确认

- [x] 1.1 确认 @modelcontextprotocol/sdk 已安装在 package.json
- [x] 1.2 创建 electron/main/mcp-manager.ts 文件
- [x] 1.3 验证 spike-mcp-client.ts 可访问,用于 API 参考

## 2. TypeScript 类型定义

- [x] 2.1 定义 McpConnectionError 自定义错误类
- [x] 2.2 定义错误码枚举: 'SPAWN_FAILED' | 'HANDSHAKE_TIMEOUT' | 'SERVER_CRASHED'
- [x] 2.3 定义 FileEntry 接口(name, path, size, type, lastModified)
- [x] 2.4 定义连接状态类型: 'disconnected' | 'connecting' | 'connected' | 'error'
- [x] 2.5 定义 McpStatus 接口(status, currentPath, lastError)

## 3. 单例模式实现

- [x] 3.1 创建 McpManager 类,私有构造函数
- [x] 3.2 实现静态 getInstance() 方法
- [x] 3.3 声明私有静态 instance 属性
- [x] 3.4 测试多次调用 getInstance() 返回同一实例

## 4. 内部状态管理

- [x] 4.1 声明私有 client 属性(Client | null)
- [x] 4.2 声明私有 transport 属性(StdioClientTransport | null)
- [x] 4.3 声明私有 status 属性(初始值 'disconnected')
- [x] 4.4 声明私有 currentPath 属性(string | null)
- [x] 4.5 声明私有 lastError 属性(Error | null)
- [x] 4.6 实现 getStatus() 公共方法,返回当前状态快照

## 5. connectLocal() 核心实现

- [x] 5.1 实现 connectLocal(path: string): Promise<void> 方法签名
- [x] 5.2 参数验证: 检查 path 是否为非空字符串
- [x] 5.3 状态检查: 如果已连接且路径相同,直接返回
- [x] 5.4 状态检查: 如果已连接但路径不同,先调用 disconnect()
- [x] 5.5 更新状态为 'connecting',设置 currentPath
- [x] 5.6 调用内部 _attemptConnection(path) 方法(带重试逻辑)

## 6. MCP Client 连接逻辑

- [x] 6.1 创建 StdioClientTransport 实例,配置 npx -y @modelcontextprotocol/server-filesystem
- [x] 6.2 创建 Client 实例,配置 name: "immerseai-client", version: "1.0.0"
- [x] 6.3 调用 client.connect(transport) 建立连接
- [x] 6.4 连接成功后更新状态为 'connected',清空 lastError
- [x] 6.5 捕获 spawn 失败,抛出 McpConnectionError('SPAWN_FAILED')
- [x] 6.6 捕获 handshake 超时,抛出 McpConnectionError('HANDSHAKE_TIMEOUT')

## 7. 指数退避重试机制

- [x] 7.1 定义常量 RETRY_DELAYS = [2000, 4000, 8000], MAX_RETRIES = 3
- [x] 7.2 实现 _attemptConnection(path, retryCount = 0) 私有方法
- [x] 7.3 try-catch 包裹连接逻辑,失败时检查 retryCount < MAX_RETRIES
- [x] 7.4 如果可重试,记录日志 "Retrying MCP connection (X/3)..."
- [x] 7.5 等待 RETRY_DELAYS[retryCount] 毫秒后递归调用 _attemptConnection(path, retryCount+1)
- [x] 7.6 如果重试耗尽,更新状态为 'error',设置 lastError,抛出错误
- [x] 7.7 重试成功时停止后续重试,返回成功

## 8. disconnect() 实现

- [x] 8.1 实现 disconnect(): Promise<void> 方法
- [x] 8.2 检查当前状态,如果已是 'disconnected',直接返回
- [x] 8.3 如果 client 存在,调用 client.close()
- [x] 8.4 如果 transport 和子进程存在,调用 subprocess.kill()
- [x] 8.5 清空 client, transport 引用(设为 null)
- [x] 8.6 更新状态为 'disconnected',清空 currentPath
- [x] 8.7 捕获并记录清理过程中的错误(但不阻断清理)

## 9. Electron 主进程生命周期集成

- [x] 9.1 在 electron/main/index.ts 导入 McpManager
- [x] 9.2 监听 app.on('quit') 或 app.on('will-quit') 事件
- [x] 9.3 在退出事件中调用 McpManager.getInstance().disconnect()
- [x] 9.4 使用 event.preventDefault() + async disconnect + app.quit() 确保清理完成
- [x] 9.5 测试 Electron 应用退出时子进程正确终止

## 10. 文件操作 - listFiles()

- [x] 10.1 实现 listFiles(path: string): Promise<FileEntry[]> 方法
- [x] 10.2 检查连接状态,未连接时抛出错误 "Not connected to MCP server"
- [x] 10.3 记录日志 "[McpManager] listFiles: ${path}"
- [x] 10.4 调用 client.request({ method: 'tools/call', params: { name: 'list_directory', arguments: { path } } }, CallToolResultSchema)
- [x] 10.5 解析 MCP 返回结果,转换为 FileEntry[] 格式
- [x] 10.6 记录日志 "[McpManager] listFiles completed: ${fileCount} items"
- [x] 10.7 捕获并包装 MCP 错误(目录不存在 -> "Directory not found", 权限错误 -> "Permission denied")

## 11. 文件操作 - readFile()

- [x] 11.1 实现 readFile(path: string): Promise<string | ArrayBuffer> 方法
- [x] 11.2 检查连接状态,未连接时抛出错误
- [x] 11.3 记录日志 "[McpManager] readFile: ${path}"
- [x] 11.4 调用 MCP Tool 'read_file' 且参数为 path
- [x] 11.5 根据返回内容类型判断返回 string 或 ArrayBuffer
- [x] 11.6 捕获并包装 MCP 错误(文件不存在 -> "File not found", 文件过大 -> 包含大小信息)

## 12. 文件操作 - writeFile()

- [x] 12.1 实现 writeFile(path: string, content: string): Promise<void> 方法
- [x] 12.2 检查连接状态,未连接时抛出错误
- [x] 12.3 记录日志 "[McpManager] writeFile: ${path}"
- [x] 12.4 调用 MCP Tool 'write_file' 且参数为 path 和 content
- [x] 12.5 等待操作完成,返回成功 Promise
- [x] 12.6 捕获并包装 MCP 错误(目录不存在 -> "Directory not found", 权限错误 -> "Permission denied")

## 13. 文件操作 - moveFile()

- [x] 13.1 实现 moveFile(source: string, destination: string): Promise<void> 方法
- [x] 13.2 检查连接状态,未连接时抛出错误
- [x] 13.3 记录日志 "[McpManager] moveFile: ${source} -> ${destination}"
- [x] 13.4 调用 MCP Tool 'move_file' 且参数为 source 和 destination
- [x] 13.5 等待操作完成,返回成功 Promise
- [x] 13.6 捕获并包装 MCP 错误(源文件不存在 -> "Source file not found", 目标已存在 -> "Destination exists")

## 14. 错误处理完善

- [x] 14.1 实现 McpConnectionError 类的 toString() 方法
- [x] 14.2 为所有公共方法添加 JSDoc 注释,包括 @throws 说明
- [x] 14.3 确保所有 Promise rejection 都有对应的错误类型
- [x] 14.4 实现错误消息国际化准备(中文错误描述)
- [x] 14.5 添加用户友好的错误转换函数 _wrapMcpError(error)

## 15. 日志系统集成

- [x] 15.1 在文件顶部导入 electron-log 或使用 console 统一包装
- [x] 15.2 定义日志前缀 "[McpManager]"
- [x] 15.3 在 connectLocal() 开始时记录日志
- [x] 15.4 在重试时记录警告级别日志,包含重试次数
- [x] 15.5 在连接成功时记录信息级别日志
- [x] 15.6 在所有文件操作前后记录日志
- [x] 15.7 捕获子进程 stderr 输出,前缀 "[MCP Server]" 记录
- [x] 15.8 脱敏用户路径(隐藏用户名部分)

## 16. Windows 路径兼容性

- [x] 16.1 导入 Node.js path 模块
- [x] 16.2 在所有路径参数传递前使用 path.normalize()
- [x] 16.3 测试 Windows 反斜杠路径(C:\Users\...) 是否正确处理
- [x] 16.4 测试 macOS/Linux 正斜杠路径是否正确处理

## 17. TypeScript 类型验证

- [x] 17.1 运行 npx tsc --noEmit 检查 mcp-manager.ts 类型错误
- [x] 17.2 确保所有公共方法有完整的类型签名(无 any)
- [x] 17.3 确保 FileEntry, McpStatus 等类型可被外部导入
- [x] 17.4 测试类型守卫(instanceof McpConnectionError) 正常工作
- [x] 17.5 确认 IDE 中调用 listFiles() 等方法有自动补全

## 18. 单元测试(可选,本次可跳过)

- [ ] 18.1 创建 mcp-manager.spec.ts 测试文件
- [ ] 18.2 测试单例模式: getInstance() 返回同一实例
- [ ] 18.3 mock StdioClientTransport,测试 connectLocal() 连接成功
- [ ] 18.4 测试重试逻辑: 第 2 次重试成功的场景
- [ ] 18.5 测试 disconnect() 正确清理资源

## 19. 集成测试

- [ ] 19.1 在 Electron 主进程启动后调用 McpManager.getInstance().connectLocal(<测试路径>)
- [ ] 19.2 测试 listFiles() 返回真实目录内容
- [ ] 19.3 测试 readFile() 读取真实 .txt 文件
- [ ] 19.4 测试 writeFile() 创建新文件
- [ ] 19.5 测试 moveFile() 重命名文件
- [ ] 19.6 测试连接失败场景(无效路径),验证重试和错误抛出
- [ ] 19.7 观察 Chrome DevTools Console 中的日志输出

## 20. 最终验证

- [x] 20.1 运行 npm run dev,验证 Electron 应用启动无报错
- [x] 20.2 运行 npx tsc --noEmit,确认 0 错误
- [x] 20.3 运行 npm run build,确认生产构建成功
- [x] 20.4 检查代码符合宪法约束(单例模式、Sidecar Pattern、错误处理)
- [x] 20.5 确认所有公共方法都在 electron/main/mcp-manager.ts 中导出
