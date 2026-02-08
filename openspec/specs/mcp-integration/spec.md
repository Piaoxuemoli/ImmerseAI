# MCP 集成规范

## 目的
定义 MCP 协议在 ImmerseAI 中的使用方式和连接管理。

## 需求

### Requirement: McpManager 单例
系统 SHALL 实现 McpManager 作为单例类，管理所有 MCP 连接的生命周期。

#### Scenario: 连接本地文件系统
- WHEN 用户选择本地目录作为书架
- THEN McpManager 通过 StdioClientTransport 启动 server-filesystem
- AND 连接状态更新为 'connected'

#### Scenario: 连接失败重试
- WHEN MCP Server 子进程崩溃
- THEN McpManager 自动重试连接，最多 3 次
- AND 每次重试间隔 2 秒

### Requirement: 统一资源接口
McpManager SHALL 向上层暴露统一接口：
- listFiles(path): 列出目录
- readFile(path): 读取文件
- writeFile(path, content): 写入文件
- moveFile(source, dest): 移动文件

无论底层是 Local 还是 GitHub，接口行为一致。

### Requirement: 安全边界
MCP Server SHALL 仅能访问用户显式选择的目录。
GitHub PAT SHALL 存储在 Electron safeStorage 中。
Token SHALL NOT 出现在日志或配置文件中。
