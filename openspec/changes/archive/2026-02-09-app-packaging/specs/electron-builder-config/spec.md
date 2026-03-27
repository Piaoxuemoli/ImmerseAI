## ADDED Requirements

### Requirement: electron-builder 配置
系统 SHALL 使用 electron-builder 生成可分发的安装包，配置包含构建目标、ASAR 与 npm 脚本。

#### Scenario: 配置文件存在
- **WHEN** 项目需要执行打包
- **THEN** 系统 SHALL 提供 electron-builder 配置（位于 `package.json` 的 `build` 字段或独立配置文件如 `electron-builder.yml`）
- **AND** 配置 SHALL 包含 Windows 与 macOS 目标（如 Windows 产出 .exe、macOS 产出 .dmg）

#### Scenario: ASAR 启用
- **WHEN** 执行 electron-builder 打包
- **THEN** 系统 SHALL 启用 ASAR 打包（`asar: true` 或等效）
- **AND** 应用主进程与渲染进程代码 SHALL 被包含在 asar 包内（除配置为 asarUnpack 的内容外）

#### Scenario: 打包脚本
- **WHEN** 开发者或 CI 执行 `npm run pack`（或文档约定的等价命令）
- **THEN** 系统 SHALL 先执行现有构建（如 `npm run build`）
- **AND** 再执行 electron-builder 生成安装包
- **AND** 脚本 SHALL 可在项目根通过 npm 调用

#### Scenario: 构建产物输出
- **WHEN** 打包成功完成
- **THEN** Windows 目标 SHALL 产出可执行安装包（如 .exe）
- **AND** macOS 目标 SHALL 产出 .dmg（或配置的其它格式）
- **AND** 输出目录 SHALL 符合 electron-builder 默认或配置的 `output` 路径
