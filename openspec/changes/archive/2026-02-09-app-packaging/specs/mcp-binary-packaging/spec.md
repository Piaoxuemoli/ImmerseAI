## ADDED Requirements

### Requirement: MCP server-filesystem 打包可用
系统 SHALL 确保打包后的应用中，MCP server-filesystem 可被主进程正确启动，不依赖用户环境中的全局 npx 或 Node。

#### Scenario: 依赖包含
- **WHEN** 执行打包
- **THEN** 系统 SHALL 将 `@modelcontextprotocol/server-filesystem` 或其运行所需产物包含在打包结果中
- **AND** 包含方式可为应用 dependency、extraResources、或 asarUnpack 等，使主进程在打包环境下能解析到可执行入口

#### Scenario: 主进程启动路径
- **WHEN** 应用以打包形态运行（如 `app.isPackaged === true`）
- **THEN** 主进程 SHALL 通过 Node 可解析路径（如基于 `app.getAppPath()`、`process.resourcesPath` 或 `app.asar.unpacked`）定位 MCP server-filesystem 的可执行入口
- **AND** 使用该路径启动子进程，而非依赖全局 `npx -y`

#### Scenario: 开发环境兼容
- **WHEN** 应用以开发形态运行（未打包）
- **THEN** 主进程可继续使用现有方式（如 `npx -y @modelcontextprotocol/server-filesystem`）启动 MCP
- **AND** 打包与开发两种路径 SHALL 均可成功建立 MCP 连接（在各自环境下）

#### Scenario: 打包后运行验证
- **WHEN** 在目标平台安装并运行打包产物
- **THEN** 应用 SHALL 能正常启动
- **AND** 用户选择书架目录后，MCP 连接 SHALL 可建立（或明确报错而非静默失败）
