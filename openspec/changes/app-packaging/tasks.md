## 1. electron-builder 配置与脚本

- [x] 1.1 在 `package.json` 中新增 `"build"` 配置（或创建 `electron-builder.yml`），设置 `appId`、`productName`、`directories.output` 等基础项
- [x] 1.2 配置 Windows 目标（如 `win: { target: ["nsis"] }` 或 portable）与 macOS 目标（如 `mac: { target: ["dmg"] }`）
- [x] 1.3 在 build 配置中启用 `asar: true`
- [x] 1.4 在 `package.json` 的 `scripts` 中新增 `"pack": "npm run build && electron-builder"`（或带 `--config` 若使用独立配置文件）
- [x] 1.5 确认 `electron-builder` 已存在于 devDependencies（已有则跳过）

## 2. 应用图标与元数据

- [x] 2.1 在项目根下创建 `build` 目录（若不存在），并准备 `build/icon.png`（建议 512x512 或 1024x1024）；若暂用占位图，在 README 或文档中说明
- [x] 2.2 在 electron-builder 配置中指定 `icon: "build/icon.png"`（或确认默认读取该路径）
- [x] 2.3 确认 `.gitignore` 中已包含 `!build/icon.png`，以便图标可提交（当前已有则仅验证）

## 3. MCP server-filesystem 打包与主进程路径

- [x] 3.1 将 `@modelcontextprotocol/server-filesystem` 加入 `package.json` 的 dependencies（或按设计通过 extraResources/asarUnpack 包含）
- [x] 3.2 在 McpManager（或启动 MCP 的模块）中根据 `app.isPackaged` 分支：打包时使用 Node 可解析路径（如 `process.resourcesPath`、`app.getAppPath()`、或 asar.unpacked 下 node_modules）定位并启动 MCP；开发时保持现有 `npx -y @modelcontextprotocol/server-filesystem`
- [x] 3.3 若需 asarUnpack，在 electron-builder 配置中列出 MCP 相关目录，确保子进程可执行

## 4. 验证与收尾

- [x] 4.1 在 Windows 上执行 `npm run pack`，确认产出 .exe（或配置的格式）且无报错
- [ ] 4.2 在 macOS 上执行 `npm run pack`，确认产出 .dmg（或配置的格式）且无报错
- [x] 4.3 在至少一个目标平台上安装打包产物并启动应用，验证窗口与基本功能正常
- [x] 4.4 在已安装的打包应用中测试「选择书架目录」并确认 MCP 连接可建立或错误提示明确
