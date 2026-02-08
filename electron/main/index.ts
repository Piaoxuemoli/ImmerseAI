import { app, BrowserWindow, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc-handlers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 保持对窗口对象的全局引用，防止被垃圾回收
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // 等待 ready-to-show 事件
    webPreferences: {
      // 安全配置：遵循项目宪法
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Electron 的沙箱在 Windows 上可能有兼容性问题
      preload: path.join(__dirname, '../preload/index.js')
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
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
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
app.on('window-all-closed', () => {
  // macOS 保持应用运行，其他平台退出
  if (process.platform !== 'darwin') {
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
