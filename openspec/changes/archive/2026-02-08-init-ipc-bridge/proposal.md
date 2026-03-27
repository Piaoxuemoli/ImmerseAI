## Why

当前的 IPC bridge 实现使用 `unknown` 类型作为参数和返回值，缺乏编译时类型检查。这导致渲染进程调用 IPC 时无法获得正确的 TypeScript 提示，增加了类型错误的风险。需要完善 IPC 接口的类型定义，确保端到端的类型安全。

## What Changes

- 在 `electron/preload/index.ts` 中将所有 IPC 方法的类型从 `unknown` 替换为具体的领域类型（`BookFile[]`, `Message[]`, `AppConfig` 等）
- 在 `electron/main/ipc-handlers.ts` 中为所有 handler 添加明确的参数和返回值类型注解
- 在 `src/shared/types/electron.d.ts` 中更新 `ElectronAPI` 接口定义，确保类型与实现一致
- 确保 LLM streaming API 使用类型安全的 `ReadableStream<string>` 而非 event-based 模式
- 验证所有 8 个 IPC channels 的类型签名与项目 constitution 中定义的契约一致：
  - `mcp:listFiles(path: string) → Promise<BookFile[]>`
  - `mcp:readFile(path: string) → Promise<ArrayBuffer>`
  - `mcp:writeFile(path: string, content: string) → Promise<void>`
  - `mcp:moveFile(source: string, dest: string) → Promise<void>`
  - `llm:chat(messages: Message[], config: LlmConfig) → ReadableStream<string>`
  - `app:selectDirectory() → Promise<string | null>`
  - `app:getSafeStorage(key: string) → Promise<string>`
  - `app:setSafeStorage(key: string, value: string) → Promise<void>`

## Capabilities

### New Capabilities

无。所有 IPC 接口的 requirements 已在 `preload-bridge` spec 中定义。

### Modified Capabilities

- `preload-bridge`: 添加类型安全 requirements，要求所有 IPC 接口必须使用具体的 TypeScript 类型而非 `unknown`，并确保 preload 和 main 的类型签名一致。

## Impact

**受影响的文件**:
- `electron/preload/index.ts` - 更新 IPC 方法的类型定义
- `electron/main/ipc-handlers.ts` - 为所有 handlers 添加类型注解
- `src/shared/types/electron.d.ts` - 更新全局类型声明
- `src/shared/types/index.ts` - 可能需要添加 `LlmConfig` 等缺失的类型

**受影响的系统**:
- 所有依赖 `window.electronAPI` 的渲染进程组件将获得完整的 TypeScript IntelliSense
- TypeScript 编译器将能够在编译时检测 IPC 调用的类型错误

**性能影响**: 无，仅类型层面的改进

**安全影响**: 正向 - 减少运行时类型错误，增强代码可维护性
