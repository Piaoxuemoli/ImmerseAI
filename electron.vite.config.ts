import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  // 主进程配置
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      target: 'node18',
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/main/index.ts')
        },
        output: {
          format: 'es'
        }
      }
    }
  },

  // Preload 脚本配置
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      target: 'node18',
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/preload/index.ts')
        },
        output: {
          format: 'es'
        }
      }
    }
  },

  // 渲染进程配置
  renderer: {
    root: '.',
    build: {
      target: 'esnext',
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html')
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    plugins: [react()],
    server: {
      port: 5173
    }
  }
})
