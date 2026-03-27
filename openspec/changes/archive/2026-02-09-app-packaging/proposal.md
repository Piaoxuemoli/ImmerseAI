## Why

应用当前仅支持开发模式运行，无法产出可分发的安装包。配置 electron-builder 后，可生成 Windows (.exe) 与 macOS (.dmg) 安装包，便于交付与安装；同时需保证 ASAR 打包、应用图标、以及 MCP server-filesystem 等原生依赖被正确包含，打包产物可正常运行。

## What Changes

- 新增 **electron-builder** 配置（如 `electron-builder.yml` 或 `package.json` 的 build 段），目标为 Windows 可执行安装包与 macOS .dmg。
- 应用图标与元数据：在项目根下提供 **`build/icon.png`**，供 electron-builder 生成各平台图标（.ico / .icns）；如需将图标纳入版本控制，在 `.gitignore` 中保留对 `build/icon.png` 的例外（当前已存在 `!build/icon.png`）。
- 启用 **ASAR** 打包，将应用代码打包为 asar 以符合常见分发形态。
- 构建与打包脚本：提供 **`npm run build`**（现有）与 **`npm run pack`**（或等价），执行顺序为先 build 再 pack，便于 CI/本地一键打包。
- **MCP server-filesystem** 二进制：确保其被正确包含在打包产物中（如 extraResources 或 extraFiles），运行时主进程能解析并启动。
- 自动更新配置：**可选**，本变更仅预留扩展点或占位，不强制实现。
- 验证：打包产物在目标平台可安装并正常运行（含 MCP 能力）。

## Capabilities

### New Capabilities

- `electron-builder-config`: electron-builder 配置文件、构建目标（Windows exe、macOS dmg）、ASAR 开关、以及 npm 脚本（build + pack）。
- `app-icon-metadata`: 应用图标路径约定（`build/icon.png`）、产物图标生成、与仓库忽略规则说明。
- `mcp-binary-packaging`: MCP server-filesystem 二进制在打包时的包含方式与主进程解析路径，确保打包后可用。

### Modified Capabilities

- （无。build-system 仅增加调用 pack 的脚本约定，不改变现有 Vite/electron-vite 构建需求。）

## Impact

- **配置文件**：新增或修改 `electron-builder.yml` / `package.json` 的 `build` 字段；可能新增 `build/` 目录与 `build/icon.png`。
- **依赖**：新增 `electron-builder` 为 devDependency。
- **脚本**：`package.json` 中新增 `pack`（或 `dist`）脚本，依赖现有 `build`。
- **主进程**：若 MCP 二进制路径在开发与打包环境下不同，主进程需按运行环境解析二进制路径（如 `app.isPackaged` + `path.join(process.resourcesPath, ...)`）。
- **CI/文档**：可增加打包与验证步骤说明；自动更新为可选扩展。
