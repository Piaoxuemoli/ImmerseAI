## Why

ImmerseAI 需要一个符合项目宪法约束的 Electron 桌面应用基础设施。当前项目只有文档和规范，缺少可运行的代码框架。建立脚手架是开始开发的前提，必须正确配置 Electron 双进程架构、Web Worker 支持、IPC 安全通信以及 TailwindCSS UI 系统，确保后续所有功能开发都在正确的技术边界内进行。

## What Changes

- 初始化 Electron 28+ 项目，使用 electron-vite 作为构建工具
- 配置主进程（Main Process）+ 渲染进程（Renderer Process）双进程架构
- 实现 preload 脚本，通过 contextBridge 建立安全的 IPC 通信管道
- 搭建 React 18+ 应用，配置 react-router-dom v6 路由系统
- 集成 TailwindCSS v3+ + shadcn/ui 组件库 + lucide-react 图标库
- 建立 Feature-based 目录结构（bookshelf / reader / chat / persona）
- 配置 TypeScript strict mode 和 ESLint/Prettier 代码规范
- 启用 BrowserWindow Cross-Origin headers 以支持 Transformers.js Web Worker
- 配置 Vite 优化（Worker 支持、Transformers.js 排除预打包）

## Capabilities

### New Capabilities

- `build-system`: Vite + electron-vite 构建配置，包括主进程/渲染进程/Worker 的打包策略
- `electron-infrastructure`: Electron 主进程入口、BrowserWindow 配置、安全策略（nodeIntegration=false, contextIsolation=true）
- `preload-bridge`: preload 脚本和 contextBridge IPC 接口定义，建立渲染进程到主进程的安全通信
- `react-infrastructure`: React 应用入口、路由配置（/bookshelf, /reader/:id）、Provider 组合
- `styling-system`: TailwindCSS 配置、shadcn/ui 集成、设计 token 定义（Notion 极简风格）
- `project-structure`: Feature-based 目录结构约定和模块划分规则

### Modified Capabilities

- `architecture`: 更新以包含 Electron 具体配置细节、IPC channel 定义、Worker 加载策略

## Impact

**新增文件**:
- `electron/main/index.ts` - 主进程入口
- `electron/preload/index.ts` - preload 脚本
- `src/main.tsx` - React 入口
- `src/app/router.tsx` - 路由配置
- `vite.config.ts` / `electron.vite.config.ts` - 构建配置
- `tailwind.config.ts` - TailwindCSS 配置
- `tsconfig.json` / `tsconfig.node.json` - TypeScript 配置

**依赖安装**:
- 参考 `docs/dependencies.json` 的完整依赖清单
- 核心依赖：electron, electron-vite, react, react-router-dom, tailwindcss, @radix-ui/* (shadcn/ui 底层)

**开发工作流**:
- `npm run dev` 启动 Electron 开发模式
- 热重载支持（主进程和渲染进程）
- TypeScript 严格模式检查

**后续模块依赖**:
- 所有 Phase 2-5 的功能开发都依赖此脚手架
- MCP 集成、RAG Worker、LLM Handler 都需要基于此 IPC 架构
