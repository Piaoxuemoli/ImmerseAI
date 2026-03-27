## 1. Safe Storage 模块

- [x] 1.1 创建 `electron/main/safe-storage.ts`，导入 `safeStorage` 和 `app` from `electron`，导入 `fs` 和 `path`
- [x] 1.2 实现 `getStoragePath()` 辅助函数，返回 `path.join(app.getPath('userData'), 'safe-storage.json')`
- [x] 1.3 实现 `readStorageFile()` 辅助函数，读取 JSON 文件并解析为 `Record<string, string>`，文件不存在或 JSON 无效时返回 `{}`
- [x] 1.4 实现 `writeStorageFile(data: Record<string, string>)` 辅助函数，将数据写入 JSON 文件
- [x] 1.5 实现 `getSafeStorageValue(key: string): string`，检查 `isEncryptionAvailable()`，不可用返回 `''`；可用则从文件读取 base64 → Buffer → `decryptString()` → 返回明文；key 不存在返回 `''`
- [x] 1.6 实现 `setSafeStorageValue(key: string, value: string): boolean`，检查 `isEncryptionAvailable()`，不可用返回 `false`；可用则 `encryptString(value)` → Buffer → base64 → 合并写入 JSON 文件 → 返回 `true`
- [x] 1.7 验证：TypeScript 编译通过，导出签名与 spec 一致

## 2. LLM Handler 模块

- [x] 2.1 创建 `electron/main/llm-handler.ts`，导入 `OpenAI` from `openai`，导入 `getSafeStorageValue` from `./safe-storage`
- [x] 2.2 定义 `PROVIDER_BASE_URLS` 常量映射表（deepseek / kimi / moonshot / openai）
- [x] 2.3 定义并导出 `DEFAULT_LLM_CONFIG` 常量（temperature: 0.7, maxTokens: 2048, model: 'deepseek-chat'）
- [x] 2.4 实现 `resolveBaseUrl(provider, customBaseUrl?)` 辅助函数，解析已知 provider 的 baseUrl 或使用 custom 值
- [x] 2.5 实现 `computeConfigHash(apiKey, provider, baseUrl)` 辅助函数，用于 client 脏检测
- [x] 2.6 实现 `getOrCreateClient(config)` 函数，维护模块级 `{ client, configHash }` 缓存，configHash 不匹配时重建；创建 `new OpenAI({ apiKey, baseURL, maxRetries: 2, timeout: 30000 })`
- [x] 2.7 实现 `LlmChatError` 类型定义 `{ code: string, message: string }`，用于结构化错误
- [x] 2.8 实现 `classifyError(error: unknown): LlmChatError` 辅助函数，将 OpenAI SDK 异常分类为 AUTH_FAILED / RATE_LIMITED / NETWORK_ERROR / UNKNOWN_ERROR
- [x] 2.9 导出 `handleLlmChat(event, messages, config)` 主函数：合并默认配置 → 从 safeStorage 获取 apiKey → 缺失则 throw API_KEY_NOT_CONFIGURED → 获取/创建 client → 流式调用 → 逐 chunk 发送 → 错误时发送 llm:chat-error + [DONE] → 正常结束发送 [DONE]
- [x] 2.10 在 `handleLlmChat` 的 for-await 循环中添加 `event.sender.isDestroyed()` 检查，销毁时提前 break
- [x] 2.11 验证：TypeScript 编译通过，所有类型完整无 any

## 3. IPC Handlers 集成

- [x] 3.1 在 `ipc-handlers.ts` 中导入 `handleLlmChat` from `./llm-handler` 和 `getSafeStorageValue` / `setSafeStorageValue` from `./safe-storage`
- [x] 3.2 替换 `llm:chat` handler：移除 mock 逻辑，改为调用 `handleLlmChat(event, messages, config)`
- [x] 3.3 替换 `app:get-safe-storage` handler：移除 TODO 占位，改为调用 `getSafeStorageValue(key)` 并返回结果
- [x] 3.4 替换 `app:set-safe-storage` handler：移除 TODO 占位，改为调用 `setSafeStorageValue(key, value)` 并返回 boolean
- [x] 3.5 验证：TypeScript 编译通过，handler 签名与 preload 类型匹配

## 4. Preload Bridge 修改

- [x] 4.1 在 `preload/index.ts` 的 `llm.chat()` ReadableStream 中注册 `llm:chat-error` 事件监听器
- [x] 4.2 `llm:chat-error` 监听器接收 `errorPayload` 后调用 `controller.error(new Error(errorPayload.message))`
- [x] 4.3 在 `[DONE]` 关闭路径和 `cancel()` 回调中同时移除 `llm:chat-chunk` 和 `llm:chat-error` 两个监听器
- [x] 4.4 在 `llm:chat-error` 触发路径中也移除两个监听器，避免泄漏
- [x] 4.5 验证：TypeScript 编译通过，`npx tsc --noEmit` 无错误

## 5. 端到端验证

- [x] 5.1 运行 `npx tsc --noEmit` 确认全项目无类型错误
- [x] 5.2 运行 `npm run build` 确认项目可构建
- [x] 5.3 Git commit：`feat(llm): implement LLM handler and safe storage`
