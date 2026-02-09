## ADDED Requirements

### Requirement: 应用图标路径约定
系统 SHALL 约定应用图标的放置位置与格式，供 electron-builder 生成各平台图标。

#### Scenario: 图标文件路径
- **WHEN** 项目需要为打包产物提供应用图标
- **THEN** 系统 SHALL 从 **`build/icon.png`** 读取源图标（项目根下的 `build` 目录内，文件名为 `icon.png`）
- **AND** electron-builder SHALL 使用该路径生成 Windows .ico 与 macOS .icns（或配置中指定的图标路径）

#### Scenario: 图标未提供时的行为
- **WHEN** `build/icon.png` 不存在且未在配置中覆盖
- **THEN** electron-builder 可使用默认图标或按工具默认行为处理
- **AND** 文档或 README SHALL 说明若需自定义图标，需提供 `build/icon.png`（建议尺寸如 512x512 或 1024x1024）

#### Scenario: 版本控制与忽略规则
- **WHEN** 希望将应用图标纳入版本控制
- **THEN** `.gitignore` SHALL 允许 `build/icon.png` 被提交（如已存在 `!build/icon.png` 例外则满足）
- **AND** 若 `build/` 目录被整体忽略，仅 `build/icon.png` 可被例外纳入仓库
