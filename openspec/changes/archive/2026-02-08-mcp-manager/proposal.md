## Why

当前架构中,虽然 mcp-integration spec 已定义了 MCP 协议集成的需求,但 McpManager 单例类尚未实现。为了让 Electron 主进程能够通过 MCP 协议管理本地书库文件系统,需要立即实现这个核心基础设施组件。没有 McpManager,书架连接器无法工作,用户无法挂载书架。

## What Changes

- 在 `electron/main/mcp-manager.ts` 创建 McpManager 单例类
- 集成 `@modelcontextprotocol/sdk` 的 Client 和 StdioClientTransport
- 实现 `connectLocal(path)` 方法,通过 child_process spawn 启动 `@modelcontextprotocol/server-filesystem` 子进程
- 实现连接失败自动重试机制(最多 3 次,间隔 2 秒)
- 实现 `disconnect()` 方法,正确清理子进程和连接状态
- 暴露文件操作方法:
  - `listFiles(path)`: 列出目录内容
  - `readFile(path)`: 读取文件内容
  - `writeFile(path, content)`: 写入文件
  - `moveFile(source, dest)`: 移动/重命名文件
- 为所有方法添加完整的错误处理和 TypeScript 类型定义
- 严格参考 `docs/spikes/spike-mcp-client.ts` 的 API 用法

## Capabilities

### New Capabilities
- `mcp-manager`: 定义 McpManager 单例类的完整实现规范,包括连接管理、错误处理、重试逻辑和文件操作接口

### Modified Capabilities
<!-- 无需修改现有 spec 的 requirements。mcp-integration spec 已定义高层需求,本 change 创建详细的实现级 spec -->

## Impact

**受影响的代码:**
- **新建**: `electron/main/mcp-manager.ts` (核心实现)
- **未来集成点**: `electron/main/ipc-handlers.ts` (IPC 桥接,后续 change)
- **未来集成点**: Bookshelf Connector (书架连接器,后续 change)

**依赖变化:**
- 已安装: `@modelcontextprotocol/sdk` (package.json 已包含)
- 需确认: `@modelcontextprotocol/server-filesystem` 是否已全局安装或需要通过 npx 运行

**架构影响:**
- 建立 Electron 主进程与 MCP Server 子进程之间的 Stdio 通信管道
- 为后续 IPC 层提供统一的文件系统抽象接口
- 遵循宪法第三章 3.3 节定义的 MCP Sidecar Pattern
