## ADDED Requirements

### Requirement: Electron 主进程入口
系统 SHALL 在 electron/main/index.ts 创建主进程入口，负责 BrowserWindow 生命周期管理。

#### Scenario: 应用启动
- WHEN Electron app.whenReady() 触发
- THEN 创建 BrowserWindow 实例
- AND 加载渲染进程的 HTML 入口文件

#### Scenario: 窗口关闭
- WHEN 用户关闭所有窗口
- THEN macOS 上保持应用运行，其他平台退出应用

### Requirement: BrowserWindow 安全配置
系统 SHALL 配置 BrowserWindow 的 webPreferences 以满足安全要求。

#### Scenario: 安全策略启用
- WHEN BrowserWindow 初始化
- THEN nodeIntegration 设为 false
- AND contextIsolation 设为 true
- AND webSecurity 设为 true
- AND preload 脚本路径正确配置

### Requirement: Cross-Origin 头部配置
系统 SHALL 在主进程拦截响应头，启用 Cross-Origin Isolation 以支持 SharedArrayBuffer。

#### Scenario: 响应头注入
- WHEN 渲染进程请求本地资源
- THEN 主进程通过 webRequest.onHeadersReceived 拦截
- AND 添加 Cross-Origin-Opener-Policy: same-origin
- AND 添加 Cross-Origin-Embedder-Policy: require-corp

#### Scenario: Transformers.js 模型加载
- WHEN Web Worker 中加载 Transformers.js 模型
- THEN SharedArrayBuffer 可用（crossOriginIsolated === true）
- AND WASM 模块正常执行

### Requirement: 开发工具配置
系统 SHALL 在开发模式下自动打开 DevTools。

#### Scenario: 开发模式 DevTools
- WHEN 应用以开发模式启动（process.env.NODE_ENV === 'development'）
- THEN BrowserWindow 自动打开 Chrome DevTools
- AND console 输出可见
