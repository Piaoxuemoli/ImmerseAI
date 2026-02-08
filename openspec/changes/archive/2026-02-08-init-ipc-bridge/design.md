## Context

**当前状态**：
- `electron/preload/index.ts` 中的 `ElectronAPI` 接口使用 `unknown` 作为大多数方法的参数和返回值类型
- `electron/main/ipc-handlers.ts` 中的 handler 函数缺乏显式的类型注解
- 渲染进程调用 `window.electronAPI` 时无法获得 TypeScript IntelliSense
- LLM streaming API 使用 event-based 模式（`ipcRenderer.on('llm:chat-chunk')`），缺乏类型安全

**项目类型架构**：
- 领域类型定义在 `src/shared/types/index.ts`（Book, Message, BookFile, AppConfig 等）
- Electron API 类型声明在 `src/shared/types/electron.d.ts`
- preload 和 main 进程通过 contextBridge 和 ipcMain/ipcRenderer 通信

**安全约束**：
- `nodeIntegration: false` - 渲染进程无法直接访问 Node.js API
- `contextIsolation: true` - preload 和 renderer 运行在隔离的上下文
- 所有 IPC channels 必须在 preload 中显式声明（白名单模式）

**技术栈**：
- Electron 28.3.0
- TypeScript 5.6 strict mode
- 已配置 path alias `@/` → `src/`

## Goals / Non-Goals

**Goals:**
- 为所有 8 个 IPC channels 提供端到端的类型安全（preload → main → renderer）
- 确保 TypeScript 能在编译时检测 IPC 调用的类型错误（参数类型、返回值类型）
- 提供完整的 IntelliSense 支持（参数提示、返回值类型推断）
- 统一 LLM streaming API 为类型安全的 `ReadableStream<string>`
- 添加缺失的类型定义（如 `LlmConfig`）

**Non-Goals:**
- 不改变 IPC channels 的功能逻辑（如 mock 数据、错误处理）
- 不新增或移除 IPC channels
- 不改变现有的安全模型（contextBridge, contextIsolation）
- 不重构 MCP 或 LLM 的实际实现（Phase 2/4 的工作）

## Decisions

### D1: 复用现有领域类型定义

**决策**：在 preload 和 main 中 import `src/shared/types/index.ts` 中的类型，而非重新定义。

**理由**：
- 避免类型重复定义和同步问题
- `src/shared/types/index.ts` 已包含所有领域模型（Book, Message, BookFile 等）
- TypeScript path alias `@/` 允许在 Electron 代码中导入 src 目录

**替代方案及拒绝原因**：
- ❌ 在 `electron/main/types.ts` 中重新定义类型 → 增加维护成本，容易不一致
- ❌ 使用 `.d.ts` 全局类型声明 → 失去 import 路径的显式性

**实现**：
```typescript
// electron/preload/index.ts
import type { BookFile, Message } from '@/shared/types'

// electron/main/ipc-handlers.ts
import type { BookFile } from '@/shared/types'
```

---

### D2: 新增 LlmConfig 类型

**决策**：在 `src/shared/types/index.ts` 中新增 `LlmConfig` 接口，包含 LLM API 调用所需的配置参数。

**理由**：
- proposal 中的 `llm:chat` 签名要求 `(messages: Message[], config: LlmConfig)`
- 当前代码中 `AppConfig.llm` 包含了部分配置，但不适合直接用于单次 API 调用
- 需要区分"全局配置"（AppConfig.llm）和"单次调用配置"（LlmConfig）

**类型定义**：
```typescript
export interface LlmConfig {
  provider?: 'deepseek' | 'kimi' | 'moonshot' | 'openai' | 'custom'
  model?: string
  temperature?: number  // 0.0 - 1.0
  maxTokens?: number
  stream?: boolean      // 是否启用流式响应，默认 true
}
```

**替代方案及拒绝原因**：
- ❌ 直接使用 `AppConfig['llm']` → 包含 apiKey 和 baseUrl，不应在每次调用时传递
- ❌ 使用 `Partial<AppConfig['llm']>` → 语义不清晰，且包含不必要的字段

---

### D3: LLM Streaming API 改为 ReadableStream

**决策**：将 `llm:chat` 的返回值从 event-based 模式改为 `Promise<ReadableStream<string>>`。

**当前实现（event-based）**：
```typescript
llm: {
  chat: (messages: unknown[], onChunk: (chunk: string) => void) => {
    ipcRenderer.on('llm:chat-chunk', (_event, chunk) => onChunk(chunk))
    return ipcRenderer.invoke('llm:chat', messages)
  }
}
```

**新实现（ReadableStream）**：
```typescript
llm: {
  chat: (messages: Message[], config: LlmConfig) => 
    Promise<ReadableStream<string>>
}
```

**理由**：
1. **类型安全**：`ReadableStream<string>` 明确表达返回类型，编译器可检查
2. **标准 API**：符合 Web Streams API 标准，与 fetch Response.body 一致
3. **内存管理**：ReadableStream 支持 backpressure，避免内存溢出
4. **可组合性**：可使用 `pipeThrough()`, `pipeTo()` 等标准方法

**兼容性验证**：
- Electron 28 使用 Chromium 118，完整支持 Streams API
- Node.js 20+ 原生支持 ReadableStream（主进程端）

**替代方案及拒绝原因**：
- ❌ 保持 event-based → 无法提供类型安全，回调地狱
- ❌ 使用 AsyncIterator → 非 Web 标准，与 fetch API 不一致

**实现策略**：
- 主进程：创建 `TransformStream`，通过 `writer.write()` 写入 chunk
- Preload：直接返回 `readable` 端
- 渲染进程：使用 `for await (const chunk of stream)` 消费

---

### D4: 类型注解位置

**决策**：
- Preload：在 `ElectronAPI` 接口定义中使用具体类型
- Main handlers：在函数签名中使用显式类型注解
- 全局类型声明：更新 `src/shared/types/electron.d.ts`

**示例**：
```typescript
// electron/preload/index.ts
const electronAPI: ElectronAPI = {
  mcp: {
    listFiles: (path: string): Promise<BookFile[]> => 
      ipcRenderer.invoke('mcp:list-files', path)
  }
}

// electron/main/ipc-handlers.ts
ipcMain.handle('mcp:list-files', async (_event, path: string): Promise<BookFile[]> => {
  // ...
})

// src/shared/types/electron.d.ts
interface ElectronAPI {
  mcp: {
    listFiles: (path: string) => Promise<BookFile[]>
  }
}
```

**理由**：
- 三处类型定义保持一致，编译器能检测不匹配
- 渲染进程通过 `window.electronAPI` 获得完整类型推断

## Risks / Trade-offs

### [Risk] 跨进程类型同步问题
**描述**：preload 和 main 的类型签名可能因手动修改而不一致，导致运行时错误。

**缓解策略**：
- 使用共享类型文件 (`src/shared/types/index.ts`)
- TypeScript 编译检查确保 `ElectronAPI` 接口实现与 handler 签名一致
- 在 tasks 中包含"验证类型一致性"检查项（`npx tsc --noEmit`）

---

### [Risk] ReadableStream 在 IPC 中的序列化
**描述**：Electron IPC 不能直接传递 `ReadableStream` 对象（因 IPC 使用结构化克隆）。

**缓解策略**：
- 主进程不返回 `ReadableStream`，而是通过 `event.sender.send()` 推送 chunks
- Preload 在接收端创建 `ReadableStream`，封装 IPC 事件监听
- 实现细节：
  ```typescript
  // preload 端创建 ReadableStream
  const stream = new ReadableStream<string>({
    start(controller) {
      const listener = (_: any, chunk: string) => {
        if (chunk === '[DONE]') controller.close()
        else controller.enqueue(chunk)
      }
      ipcRenderer.on('llm:chat-chunk', listener)
    }
  })
  ```

---

### [Trade-off] 类型定义复杂度 vs 类型安全
**描述**：引入更多具体类型（如 `LlmConfig`）增加了类型系统的复杂度。

**权衡**：
- ✅ 增加复杂度 → 换取编译时安全和 IntelliSense
- ✅ 类型定义集中在 `src/shared/types/index.ts`，易于维护
- ❌ 开发者需要理解更多类型定义

**接受原因**：类型安全是本项目 constitution 的核心约束（strict mode），复杂度增加是必要成本。

---

### [Trade-off] LlmConfig 部分可选 vs 全部必填
**描述**：`LlmConfig` 的字段设计为可选（`provider?: ...`），允许使用默认值。

**权衡**：
- ✅ 灵活性高，用户可仅覆盖部分配置
- ❌ 需要在主进程中处理默认值合并逻辑

**实现**：主进程从 `AppConfig` 读取默认值，与 `LlmConfig` 合并：
```typescript
const finalConfig = { ...defaultAppConfig.llm, ...config }
```

## Migration Plan

**无需迁移**：此 change 仅涉及类型层面的改进，不改变运行时行为。

**兼容性**：
- 现有 mock 实现保持不变
- 渲染进程中已有的 `window.electronAPI` 调用代码无需修改（仅类型推断改进）

**验证步骤**：
1. 运行 `npx tsc --noEmit` 确保无类型错误
2. 启动开发服务器 `npm run dev`，验证 Electron 应用正常启动
3. 在渲染进程 DevTools 中测试所有 IPC 调用

## Open Questions

无。所有技术决策已明确，可直接进入实现阶段。
