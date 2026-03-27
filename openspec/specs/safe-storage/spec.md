## Requirements

### Requirement: API Key 加密存储
系统 SHALL 使用 Electron 的 `safeStorage` API 对敏感数据（API Key）进行系统级加密，并将加密结果持久化到本地 JSON 文件。

#### Scenario: 存储 API Key
- **WHEN** `app:set-safe-storage` IPC handler 接收 `{ key: string, value: string }`
- **AND** `safeStorage.isEncryptionAvailable()` 返回 `true`
- **THEN** 系统调用 `safeStorage.encryptString(value)` 获取 `Buffer`
- **AND** 将 Buffer 转换为 Base64 字符串
- **AND** 将 `{ [key]: base64String }` 写入 `{userData}/safe-storage.json` 文件
- **AND** handler 返回 `true`

#### Scenario: 读取 API Key
- **WHEN** `app:get-safe-storage` IPC handler 接收 `{ key: string }`
- **AND** `safe-storage.json` 文件存在且包含该 key
- **THEN** 系统读取对应的 Base64 字符串
- **AND** 将 Base64 还原为 `Buffer`
- **AND** 调用 `safeStorage.decryptString(buffer)` 获取原始字符串
- **AND** handler 返回解密后的字符串

#### Scenario: Key 不存在
- **WHEN** `app:get-safe-storage` IPC handler 接收 `{ key: string }`
- **AND** `safe-storage.json` 文件不存在或不包含该 key
- **THEN** handler 返回空字符串 `''`

### Requirement: 持久化文件管理
系统 SHALL 将加密数据存储在 `{app.getPath('userData')}/safe-storage.json` 文件中。

#### Scenario: 文件不存在时自动创建
- **WHEN** 首次调用 `set-safe-storage`
- **AND** `safe-storage.json` 不存在
- **THEN** 系统创建新文件并写入 `{ [key]: encryptedBase64 }`

#### Scenario: 文件已存在时追加/更新
- **WHEN** 调用 `set-safe-storage`
- **AND** `safe-storage.json` 已存在
- **THEN** 系统读取现有 JSON → 合并新 key-value → 写回文件
- **AND** 不影响文件中其他已有的 key-value 对

#### Scenario: 文件读取容错
- **WHEN** `safe-storage.json` 文件内容不是有效 JSON
- **THEN** 系统将其视为空对象 `{}`
- **AND** 日志记录警告信息

### Requirement: 加密不可用降级处理
系统 SHALL 在 `safeStorage.isEncryptionAvailable()` 返回 `false` 时提供明确的降级行为。

#### Scenario: 存储时加密不可用
- **WHEN** `app:set-safe-storage` 被调用
- **AND** `safeStorage.isEncryptionAvailable()` 返回 `false`
- **THEN** handler 返回 `false`
- **AND** 不写入任何文件
- **AND** 日志记录警告 `'safeStorage encryption not available'`

#### Scenario: 读取时解密不可用
- **WHEN** `app:get-safe-storage` 被调用
- **AND** `safeStorage.isEncryptionAvailable()` 返回 `false`
- **THEN** handler 返回空字符串 `''`
- **AND** 日志记录警告

### Requirement: 模块接口
系统 SHALL 导出以下接口供 `ipc-handlers.ts` 调用。

#### Scenario: 导出函数签名
- **THEN** 模块导出 `getSafeStorageValue(key: string): string`
- **AND** 模块导出 `setSafeStorageValue(key: string, value: string): boolean`
- **THEN** 两个函数均为同步函数（`safeStorage` API 本身是同步的，文件 I/O 使用 `fs.readFileSync`/`fs.writeFileSync`）
