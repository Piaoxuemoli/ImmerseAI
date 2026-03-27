/**
 * Safe Storage - Electron safeStorage API Key 加密存储
 *
 * 使用 Electron safeStorage API 对敏感数据进行系统级加密：
 * - Windows: DPAPI
 * - macOS: Keychain
 * - Linux: libsecret
 *
 * 加密数据持久化到 {userData}/safe-storage.json
 */

import { safeStorage, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 获取 safe-storage.json 文件路径
 */
function getStoragePath(): string {
  return path.join(app.getPath('userData'), 'safe-storage.json')
}

/**
 * 读取存储文件，返回 key-value 对象
 * 文件不存在或 JSON 无效时返回空对象
 */
function readStorageFile(): Record<string, string> {
  try {
    const filePath = getStoragePath()
    if (!fs.existsSync(filePath)) {
      return {}
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as Record<string, string>
  } catch {
    console.warn('[SafeStorage] Failed to read storage file, treating as empty')
    return {}
  }
}

/**
 * 写入存储文件
 */
function writeStorageFile(data: Record<string, string>): void {
  const filePath = getStoragePath()
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 获取安全存储中的值
 * @param key 存储键名
 * @returns 解密后的值，不存在或加密不可用时返回空字符串
 */
export function getSafeStorageValue(key: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[SafeStorage] Encryption not available, returning empty string')
    return ''
  }

  const data = readStorageFile()
  const base64Value = data[key]

  if (!base64Value) {
    return ''
  }

  try {
    const buffer = Buffer.from(base64Value, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    console.warn(`[SafeStorage] Failed to decrypt value for key: ${key}`)
    return ''
  }
}

/**
 * 设置安全存储中的值
 * @param key 存储键名
 * @param value 要加密存储的值
 * @returns 成功返回 true，加密不可用返回 false
 */
export function setSafeStorageValue(key: string, value: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[SafeStorage] Encryption not available, cannot store value')
    return false
  }

  try {
    const encrypted = safeStorage.encryptString(value)
    const base64Value = encrypted.toString('base64')

    const data = readStorageFile()
    data[key] = base64Value
    writeStorageFile(data)

    return true
  } catch {
    console.error(`[SafeStorage] Failed to encrypt/store value for key: ${key}`)
    return false
  }
}
