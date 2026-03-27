## 1. 类型定义准备

- [x] 1.1 在 `src/shared/types/index.ts` 中添加 `LlmConfig` 接口（包含 provider, model, temperature, maxTokens, stream 字段，所有字段可选）
- [x] 1.2 验证 `src/shared/types/index.ts` 中已存在所需的领域类型（BookFile, Message, AppConfig 等）
- [x] 1.3 确认 TypeScript path alias `@/` 在 Electron 代码中可正常使用

## 2. Preload 层类型更新

- [x] 2.1 在 `electron/preload/index.ts` 顶部添加类型导入：`import type { BookFile, Message, LlmConfig } from '@/shared/types'`
- [x] 2.2 更新 `ElectronAPI` 接口中 `mcp.listFiles` 的返回类型为 `Promise<BookFile[]>`
- [x] 2.3 更新 `ElectronAPI` 接口中 `mcp.readFile` 的返回类型为 `Promise<ArrayBuffer>`，参数类型为 `(path: string)`
- [x] 2.4 更新 `ElectronAPI` 接口中 `mcp.writeFile` 的参数类型为 `(path: string, content: string)` 和返回类型为 `Promise<void>`
- [x] 2.5 更新 `ElectronAPI` 接口中 `mcp.moveFile` 的参数类型为 `(source: string, destination: string)` 和返回类型为 `Promise<void>`
- [x] 2.6 将 `ElectronAPI` 接口中 `llm.chat` 从 event-based 模式改为 `(messages: Message[], config: LlmConfig) => Promise<ReadableStream<string>>`
- [x] 2.7 更新 `ElectronAPI` 接口中 `app.selectDirectory` 的返回类型为 `Promise<string | null>`
- [x] 2.8 更新 `ElectronAPI` 接口中 `app.getSafeStorage` 的参数类型为 `(key: string)` 和返回类型为 `Promise<string>`
- [x] 2.9 更新 `ElectronAPI` 接口中 `app.setSafeStorage` 的参数类型为 `(key: string, value: string)` 和返回类型为 `Promise<void>`

## 3. Preload 实现代码更新

- [x] 3.1 更新 `electronAPI.mcp.listFiles` 实现，添加显式返回类型注解 `Promise<BookFile[]>`
- [x] 3.2 更新 `electronAPI.mcp.readFile` 实现，添加参数和返回类型注解
- [x] 3.3 更新 `electronAPI.mcp.writeFile` 实现，添加参数和返回类型注解
- [x] 3.4 更新 `electronAPI.mcp.moveFile` 实现，添加参数和返回类型注解
- [x] 3.5 重构 `electronAPI.llm.chat` 实现为 ReadableStream 模式：创建 ReadableStream，在 start() 中注册 ipcRenderer.on('llm:chat-chunk') 监听器
- [x] 3.6 在 ReadableStream controller 中处理 '[DONE]' 标记，调用 controller.close()
- [x] 3.7 在 ReadableStream controller 中对普通 chunk 调用 controller.enqueue(chunk)
- [x] 3.8 发起 IPC 调用 `ipcRenderer.invoke('llm:chat', messages, config)` 并返回 ReadableStream
- [x] 3.9 更新 `electronAPI.app.selectDirectory` 实现，添加返回类型注解 `Promise<string | null>`
- [x] 3.10 更新 `electronAPI.app.getSafeStorage` 实现，添加参数和返回类型注解
- [x] 3.11 更新 `electronAPI.app.setSafeStorage` 实现，添加参数和返回类型注解

## 4. Main 进程 Handler 类型更新

- [x] 4.1 在 `electron/main/ipc-handlers.ts` 顶部添加类型导入：`import type { BookFile, Message, LlmConfig } from '@/shared/types'`
- [x] 4.2 为 `mcp:list-files` handler 添加参数类型 `(_event, path: string)` 和返回类型 `Promise<BookFile[]>`
- [x] 4.3 为 `mcp:read-file` handler 添加参数类型 `(_event, path: string)` 和返回类型 `Promise<ArrayBuffer>`
- [x] 4.4 为 `mcp:write-file` handler 添加参数类型 `(_event, path: string, content: string)` 和返回类型 `Promise<void>`
- [x] 4.5 为 `mcp:move-file` handler 添加参数类型 `(_event, source: string, destination: string)` 和返回类型 `Promise<void>`
- [x] 4.6 为 `llm:chat` handler 添加参数类型 `(event, messages: Message[], config: LlmConfig)` 和返回类型 `Promise<void>`
- [x] 4.7 更新 `llm:chat` handler 接收 config 参数（当前只接收 messages）
- [x] 4.8 为 `app:select-directory` handler 添加返回类型 `Promise<string | null>`（当前实现已正确，仅需类型注解）
- [x] 4.9 为 `app:get-safe-storage` handler 添加参数类型 `(_event, key: string)` 和返回类型 `Promise<string>`
- [x] 4.10 为 `app:set-safe-storage` handler 添加参数类型 `(_event, key: string, value: string)` 和返回类型 `Promise<void>`

## 5. 全局类型声明更新

- [x] 5.1 打开 `src/shared/types/electron.d.ts` 文件
- [x] 5.2 从文件中导入类型：添加 `import type { BookFile, Message, LlmConfig } from './index'`
- [x] 5.3 更新 `ElectronAPI` 接口中 `mcp` 命名空间的所有方法签名，使用具体类型替换 `unknown`
- [x] 5.4 更新 `ElectronAPI` 接口中 `llm.chat` 方法签名为 `(messages: Message[], config: LlmConfig) => Promise<ReadableStream<string>>`
- [x] 5.5 更新 `ElectronAPI` 接口中 `app` 命名空间的所有方法签名，使用具体类型
- [x] 5.6 确保 `electron.d.ts` 中的接口定义与 preload/index.ts 中的实现完全一致

## 6. 类型安全验证

- [x] 6.1 运行 `npx tsc --noEmit` 检查是否存在类型错误
- [x] 6.2 检查编译输出，确认没有使用 `unknown` 或 `any` 的警告
- [x] 6.3 在 `electron/preload/index.ts` 中，确认所有 `electronAPI` 对象的方法实现都有显式类型注解
- [x] 6.4 在 `electron/main/ipc-handlers.ts` 中，确认所有 `ipcMain.handle` 的 handler 函数都有显式类型注解
- [x] 6.5 验证 preload 和 main 的类型签名完全一致（参数类型、返回值类型、方法名）

## 7. 开发环境测试

- [x] 7.1 运行 `npm run dev` 启动开发服务器
- [x] 7.2 验证 Electron 应用正常启动，无类型相关的运行时错误
- [x] 7.3 打开 DevTools，在 Console 中测试 `window.electronAPI` 是否存在
- [x] 7.4 在 Console 中测试调用 `window.electronAPI.mcp.listFiles('/')` 验证返回 mock 数据
- [x] 7.5 在 Console 中测试调用 `window.electronAPI.app.selectDirectory()` 验证文件选择对话框功能
- [x] 7.6 在一个 .tsx 文件中编写代码调用 `window.electronAPI`，验证 IDE 提供的 IntelliSense 和类型提示
- [x] 7.7 故意在渲染进程代码中传入错误类型的参数，验证 TypeScript 编译器能检测到错误

## 8. 文档和代码清理

- [x] 8.1 检查 `electron/preload/index.ts`，移除所有 `unknown` 类型引用
- [x] 8.2 检查 `electron/main/ipc-handlers.ts`，移除所有 `unknown` 类型引用
- [x] 8.3 在 preload 和 main 文件顶部添加注释说明类型导入来源和类型安全约束
- [x] 8.4 验证所有 TODO 注释（如 "Phase 2 将实现真实的 MCP 调用"）仍然保留，未被删除
- [x] 8.5 运行 `npm run build` 确保生产构建成功
