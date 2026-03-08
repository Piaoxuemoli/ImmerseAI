import { app, BrowserWindow, Menu, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc-handlers'
import { McpManager } from './mcp-manager'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 开发模式使用独立的 userData 目录，避免开发配置（书架路径、API Key 等）
// 污染或覆盖打包版本的用户数据
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('userData'), '__dev__'))
}

/** 打包后渲染进程入口（与 electron-builder files 布局一致） */
function getRendererPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar', 'dist-electron', 'renderer', 'index.html')
  }
  return path.join(__dirname, '../renderer/index.html')
}

// 保持对窗口对象的全局引用，防止被垃圾回收
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    maximizable: true,
    resizable: true,
    // autoHideMenuBar prevents menu-bar space from being reserved (we already
    // remove the menu via Menu.setApplicationMenu(null)), and also fixes a
    // known Windows + backgroundMaterial issue where the maximize button stops
    // responding.
    autoHideMenuBar: true,
    show: false, // 等待 ready-to-show 事件
    title: '',
    // Windows 11 毛玻璃标题栏材质。Mica 比 Acrylic 更稳定（Acrylic 在部分
    // Windows 版本上会导致最大化按钮失效）。
    ...(process.platform === 'win32' && { backgroundMaterial: 'mica' as const }),
    webPreferences: {
      // 安全配置：遵循项目宪法
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Electron 的沙箱在 Windows 上可能有兼容性问题
      preload: path.join(__dirname, '../preload/index.mjs')
    }
  })

  // 注入 Cross-Origin headers 以支持 Transformers.js Web Worker 中的 SharedArrayBuffer
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Embedder-Policy': ['require-corp'],
        'Cross-Origin-Opener-Policy': ['same-origin']
      }
    })
  })

  // 加载 URL
  if (process.env.NODE_ENV === 'development') {
    // 开发模式：加载 Vite 开发服务器
    mainWindow.loadURL('http://localhost:5173')
    // 自动打开 DevTools
    mainWindow.webContents.openDevTools()
  } else {
    // 生产模式：加载打包后的文件（显式路径以兼容 electron-builder 打包）
    mainWindow.loadFile(getRendererPath())
  }

  // 优化体验：窗口内容加载完成后再显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 窗口关闭时的处理
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Electron 初始化完成后创建窗口
app.whenReady().then(() => {
  // 移除默认应用菜单（File / Edit / View / Window / Help），由应用内 UI 承担操作
  Menu.setApplicationMenu(null)

  // 注册 IPC handlers
  registerIpcHandlers()

  createWindow()

  // macOS 特殊处理：点击 Dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时的处理
app.on('window-all-closed', async () => {
  // macOS 保持应用运行，其他平台退出
  if (process.platform !== 'darwin') {
    try {
      await McpManager.getInstance().disconnect()
    } catch {
      // ignore disconnect errors on quit
    }
    app.quit()
  }
})

// 防止多实例运行
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 用户尝试打开第二个实例时，聚焦到现有窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// 应用退出时清理 MCP 连接
app.on('quit', async () => {
  const mcpManager = McpManager.getInstance()
  await mcpManager.disconnect()
})
