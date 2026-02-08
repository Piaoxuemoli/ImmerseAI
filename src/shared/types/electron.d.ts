import { ElectronAPI } from '../../electron/preload/index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
