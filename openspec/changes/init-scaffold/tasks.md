## 1. 项目初始化

- [x] 1.1 初始化 npm 项目（参考 docs/dependencies.json）
- [x] 1.2 安装 Electron 和 electron-vite 核心依赖
- [x] 1.3 安装 React 和 react-router-dom
- [x] 1.4 安装 TypeScript 和类型定义（@types/react, @types/node）
- [x] 1.5 安装 TailwindCSS 和 PostCSS
- [x] 1.6 安装 shadcn/ui 依赖（@radix-ui/*, class-variance-authority, clsx, tailwind-merge）
- [x] 1.7 安装 lucide-react 图标库
- [x] 1.8 安装开发工具（ESLint, Prettier, prettier-plugin-tailwindcss）

## 2. 构建系统配置

- [x] 2.1 创建 electron.vite.config.ts 配置文件
- [x] 2.2 配置主进程构建（target: node, format: esm）
- [x] 2.3 配置渲染进程构建（target: esnext, format: esm）
- [x] 2.4 配置 Worker 支持（worker.format: 'es'）
- [x] 2.5 排除 @xenova/transformers 的预打包（optimizeDeps.exclude）
- [x] 2.6 配置 package.json scripts（dev, build, preview）

## 3. TypeScript 配置

- [x] 3.1 创建 tsconfig.json（渲染进程配置，DOM + React 类型）
- [x] 3.2 创建 tsconfig.node.json（主进程配置，Node.js + Electron 类型）
- [x] 3.3 启用 strict mode 和所有严格检查
- [x] 3.4 配置路径别名（@/ -> src/）

## 4. Electron 主进程实现

- [x] 4.1 创建 electron/main/index.ts 主进程入口
- [x] 4.2 实现 BrowserWindow 创建逻辑（app.whenReady）
- [x] 4.3 配置 webPreferences（nodeIntegration=false, contextIsolation=true, preload 路径）
- [x] 4.4 实现 Cross-Origin headers 注入（webRequest.onHeadersReceived）
- [x] 4.5 配置开发模式 DevTools 自动打开
- [x] 4.6 实现窗口关闭处理（macOS 保持运行，其他平台退出）

## 5. Preload 脚本和 IPC 桥接

- [x] 5.1 创建 electron/preload/index.ts
- [x] 5.2 通过 contextBridge 暴露 electronAPI 命名空间
- [x] 5.3 定义 MCP 文件操作接口（listFiles, readFile, writeFile, moveFile）
- [x] 5.4 定义 LLM 聊天接口（llmChat）
- [x] 5.5 定义应用工具接口（selectDirectory, getSafeStorage, setSafeStorage）
- [x] 5.6 创建 src/shared/types/electron.d.ts 声明 window.electronAPI 类型

## 6. 主进程 IPC Handlers 骨架

- [x] 6.1 创建 electron/main/ipc-handlers.ts
- [x] 6.2 注册 mcp:* channel handlers（返回 mock 数据）
- [x] 6.3 注册 llm:* channel handlers（返回 mock 数据）
- [x] 6.4 注册 app:* channel handlers（实现 dialog.showOpenDialog）
- [x] 6.5 在主进程入口调用 IPC handlers 注册函数

## 7. React 应用基础设施

- [x] 7.1 创建 src/main.tsx React 入口
- [x] 7.2 使用 createRoot API 挂载 React 应用到 #root
- [x] 7.3 创建 src/app/App.tsx 根组件
- [x] 7.4 创建 src/app/router.tsx 路由配置
- [x] 7.5 配置路由：/ → redirect to /bookshelf
- [x] 7.6 配置路由：/reader/:id
- [x] 7.7 创建 RouterProvider 包裹路由

## 8. Feature-based 目录结构

- [x] 8.1 创建 src/features/bookshelf/ 目录结构（components/, hooks/, store/）
- [x] 8.2 创建 src/features/reader/ 目录结构
- [x] 8.3 创建 src/features/chat/ 目录结构
- [x] 8.4 创建 src/features/persona/ 目录结构
- [x] 8.5 创建 src/shared/components/ui/ 目录（shadcn/ui 组件）
- [x] 8.6 创建 src/shared/hooks/ 目录
- [x] 8.7 创建 src/shared/lib/ 目录（utils.ts）
- [x] 8.8 创建 src/shared/types/ 目录（index.ts 全局类型）
- [x] 8.9 创建 src/workers/ 目录

## 9. TailwindCSS 配置

- [x] 9.1 创建 tailwind.config.ts
- [x] 9.2 配置 content 路径（src/**/*.{ts,tsx}）
- [x] 9.3 定义 Notion 极简风格色板（primary, secondary, border, muted, accent）
- [x] 9.4 配置字体族（Inter, system-ui, sans-serif）
- [x] 9.5 配置圆角（rounded-lg: 8px, rounded-md: 6px）
- [x] 9.6 创建 postcss.config.js（tailwindcss + autoprefixer）
- [x] 9.7 创建 src/styles/globals.css（@tailwind 指令）

## 10. shadcn/ui 集成

- [x] 10.1 运行 npx shadcn-ui@latest init
- [x] 10.2 配置 components.json（路径：src/shared/components/ui）
- [x] 10.3 安装基础组件：button
- [x] 10.4 安装基础组件：scroll-area
- [x] 10.5 安装基础组件：dialog
- [x] 10.6 安装基础组件：avatar

## 11. 占位页面创建

- [x] 11.1 创建 src/features/bookshelf/BookshelfPage.tsx（显示 "Bookshelf - Coming Soon"）
- [x] 11.2 创建 src/features/reader/ReaderPage.tsx（显示 "Reader - Coming Soon"）
- [x] 11.3 在路由配置中引用这两个页面组件

## 12. 全局类型定义

- [x] 12.1 在 src/shared/types/index.ts 定义 Book 接口
- [x] 12.2 定义 Persona 接口
- [x] 12.3 定义 Message 接口
- [x] 12.4 定义 Citation 接口
- [x] 12.5 定义 ChatSession 接口
- [x] 12.6 定义 AppConfig 接口
- [x] 12.7 定义 BookFile 接口（MCP 返回类型）

## 13. 开发工具配置

- [x] 13.1 创建 .eslintrc.cjs（TypeScript + React 规则）
- [x] 13.2 创建 .prettierrc（single quote, no semi, 2 spaces）
- [x] 13.3 配置 prettier-plugin-tailwindcss（自动排序 class）
- [x] 13.4 创建 .gitignore（node_modules/, dist/, out/）

## 14. HTML 入口文件

- [x] 14.1 创建 index.html（渲染进程入口）
- [x] 14.2 添加 <div id="root"></div>
- [x] 14.3 引入 src/main.tsx
- [x] 14.4 添加 viewport meta 标签

## 15. 验证和测试

- [x] 15.1 运行 npm run dev 启动 Electron 应用
- [x] 15.2 验证主窗口正常打开
- [x] 15.3 验证 DevTools 自动打开（开发模式）
- [x] 15.4 验证路由跳转正常（/ → /bookshelf）
- [x] 15.5 验证 TailwindCSS 样式生效
- [x] 15.6 在 Console 检查 crossOriginIsolated === true
- [x] 15.7 在 Console 检查 window.electronAPI 存在
- [x] 15.8 测试调用 window.electronAPI.selectDirectory()（打开文件选择器）
- [x] 15.9 验证 TypeScript 编译无错误
- [x] 15.10 运行 npm run build 验证生产构建成功
