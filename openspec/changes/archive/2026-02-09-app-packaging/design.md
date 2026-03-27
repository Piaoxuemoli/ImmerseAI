# App Packaging — Design

## Context

- **现状**：项目使用 electron-vite 构建，已有 `npm run build` 产出主进程与渲染进程产物；未配置 electron-builder，无法生成安装包。MCP 通过 `npx -y @modelcontextprotocol/server-filesystem` 启动，打包后用户环境可能无 npx/Node，需保证 MCP 在打包环境下可用。
- **约束**：不改变现有开发流程（`npm run dev` / `npm run build`）；打包产物需满足 Windows (.exe) 与 macOS (.dmg) 分发；若图标纳入仓库，沿用现有 `.gitignore` 对 `build/icon.png` 的例外。
- **相关模块**：`package.json` 脚本与 build 配置、主进程入口、McpManager 中 MCP 子进程启动方式。

## Goals / Non-Goals

**Goals:**

- 通过 electron-builder 产出 Windows 与 macOS 安装包，并启用 ASAR。
- 统一应用图标与元数据（`build/icon.png`），便于品牌与分发。
- 提供 `npm run pack`（或等价）脚本，执行顺序为先 build 再 pack。
- 打包后 MCP server-filesystem 可被主进程正确启动（不依赖用户全局 npx/Node）。
- 验证打包产物在目标平台可安装并正常运行。

**Non-Goals:**

- 本变更内不实现自动更新逻辑；仅可预留配置或注释，供后续扩展。
- 不改变 Vite/electron-vite 的构建产物结构或主/渲染进程入口。

## Decisions

### D1: electron-builder 配置位置与目标

- **选择**：在 `package.json` 的 `"build"` 字段中配置 electron-builder（或单独 `electron-builder.yml`，与项目现有习惯二选一）。目标：Windows 使用 `nsis` 或 `portable` 产出 .exe；macOS 产出 .dmg。启用 `asar: true`。
- **理由**：单文件配置便于与 npm 脚本同处一处；ASAR 为推荐默认，利于加载与更新。
- **备选**：多平台多配置文件 — 增加维护成本，首版单配置即可。

### D2: 应用图标与 build 目录

- **选择**：约定图标放在 **`build/icon.png`**（建议 512x512 或 1024x1024）。electron-builder 从该路径生成 Windows .ico 与 macOS .icns。不在本变更内强制提供图标文件；若不存在，builder 使用默认图标。`.gitignore` 已包含 `!build/icon.png`，图标可提交。
- **理由**：与 prompt-arsenal 及常见 electron-builder 文档一致；build 目录已被忽略，仅放开 icon.png 即可。
- **备选**：多尺寸多文件 — 非必需，单 PNG 即可满足当前目标。

### D3: 构建与打包脚本

- **选择**：新增脚本 `"pack": "npm run build && electron-builder"`（或 `electron-builder --config` 若使用独立配置文件）。保持现有 `"build": "electron-vite build"` 不变。文档或 README 中说明：打包前需先执行 build。
- **理由**：一键打包，避免漏打或顺序错误；与 apply 要求「npm run build && npm run pack」一致。
- **备选**：pack 只调 electron-builder、由 CI 先 build — 可行，但本地体验略差，首选 pack 内联 build。

### D4: MCP server-filesystem 在打包环境中的可用性

- **选择**：将 `@modelcontextprotocol/server-filesystem` 列为 **dependency**（或 devDependency 且通过 electron-builder 的 extraResources/asarUnpack 等方式包含）。主进程在打包环境下（如 `app.isPackaged`）通过 **Node 可解析路径** 启动 MCP：例如 `path.join(app.getAppPath(), 'node_modules', '.bin', '...')` 或通过 `require.resolve`/`path.join(process.resourcesPath, 'app.asar.unpacked', ...)` 定位可执行入口，替代当前直接使用 `npx -y`。
- **理由**：打包后用户环境常无 npx；将 MCP 包随应用分发可保证离线与可移植性。
- **备选**：继续使用 npx 并文档说明「需安装 Node」— 不利于普通用户，不采纳。

### D5: 自动更新

- **选择**：本变更内 **不实现** 自动更新。可在 `package.json` 的 build 中预留 `publish: null` 或注释说明后续可接入 electron-updater；不引入新依赖。
- **理由**：需求明确为可选、未来扩展；先完成打包与验证再迭代更新。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 不同平台 builder 行为差异 | 在 Windows 与 macOS 各执行一次 pack 并人工或脚本验证安装与启动 |
| MCP 路径在 dev 与 pack 下不一致导致回归 | 主进程根据 `app.isPackaged` 分支，开发环境仍用 npx；打包后用解析后的本地路径；单测或集成测覆盖两种路径 |
| 图标缺失时 builder 报错或使用默认图 | 文档说明需提供 `build/icon.png`；或配置中指定可选 icon，缺失时回退默认 |

## Migration Plan

1. **顺序**：先添加 electron-builder 配置与 pack 脚本 → 提供或占位 `build/icon.png` → 调整 MCP 启动路径逻辑（打包分支）→ 执行 pack 并在 Windows/macOS 上验证安装与运行。
2. **回退**：移除 pack 脚本与 build 配置即可恢复「仅开发构建」；不改变现有 dev/build 行为。
3. **兼容**：开发模式保持现有 `npx` 启动 MCP；仅打包后走新路径逻辑。

## Open Questions

- 无。若后续接入自动更新，再单独变更引入 electron-updater 与 publish 配置。
