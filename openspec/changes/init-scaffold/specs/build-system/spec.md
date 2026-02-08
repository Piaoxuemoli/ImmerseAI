## ADDED Requirements

### Requirement: Vite 构建配置
系统 SHALL 使用 electron-vite 作为构建工具，统一管理主进程、渲染进程和 Web Worker 的打包。

#### Scenario: 开发模式启动
- WHEN 开发者运行 `npm run dev`
- THEN electron-vite 启动主进程和渲染进程的 Vite 开发服务器
- AND 主进程和渲染进程都支持热模块替换（HMR）

#### Scenario: 生产构建
- WHEN 开发者运行 `npm run build`
- THEN electron-vite 分别打包主进程（CJS/ESM）和渲染进程（ESM）
- AND 输出文件结构符合 Electron 打包规范

### Requirement: Web Worker 支持
系统 SHALL 配置 Vite 原生支持 Web Worker，允许在 Worker 中使用 ES Module。

#### Scenario: Worker 脚本加载
- WHEN 渲染进程初始化 RAG Worker
- THEN Vite 正确打包 Worker 脚本为独立 chunk
- AND Worker 中可使用 ES Module import 语法

### Requirement: Transformers.js 优化
系统 SHALL 排除 @xenova/transformers 的 Vite 预打包，避免模型文件被错误处理。

#### Scenario: 依赖预打包
- WHEN Vite 执行依赖预打包（optimizeDeps）
- THEN @xenova/transformers 被排除在外
- AND 模型文件按需从本地缓存或 Hugging Face 加载

### Requirement: TypeScript 双配置
系统 SHALL 使用分离的 TypeScript 配置文件，主进程和渲染进程分别配置类型环境。

#### Scenario: 主进程类型检查
- WHEN TypeScript 编译主进程代码
- THEN 使用 tsconfig.node.json 配置
- AND 引入 Node.js 和 Electron 类型定义

#### Scenario: 渲染进程类型检查
- WHEN TypeScript 编译渲染进程代码
- THEN 使用 tsconfig.json 配置
- AND 引入 DOM 和 React 类型定义
