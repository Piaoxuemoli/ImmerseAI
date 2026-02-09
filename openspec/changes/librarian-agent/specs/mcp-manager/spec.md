## ADDED Requirements

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
