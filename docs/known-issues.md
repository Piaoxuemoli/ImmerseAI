# ImmerseAI 已知坑 & 排雷手册

> 更新日期：2026-02-09 | 全量验证后整理

## 🚨 高优先级（开发前必须知道）

### 1. Transformers.js + Electron + Vite Worker 兼容性
**问题**：@xenova/transformers 在 Vite 的 Web Worker 中可能报 `SharedArrayBuffer is not defined`
**原因**：Electron 的渲染进程默认没有启用 `crossOriginIsolated`
**解决**：
```ts
// electron/main/index.ts 中配置
win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Cross-Origin-Opener-Policy': ['same-origin'],
      'Cross-Origin-Embedder-Policy': ['require-corp'],
    },
  });
});
```

### 2. Orama persist/restore 后向量搜索结果不一致

**问题**：GitHub issue #695 — restore 后的向量搜索分数可能与原始不同
**解决**：

- 使用 `"json"` 格式进行 persist（不要用 binary）
- restore 后重新测试搜索，确保结果一致
- 如果仍有问题，考虑在 restore 后重建向量索引

### 3. MCP Server 子进程在 Electron 打包后找不到 npx

**问题**：打包后 `npx` 不在 PATH 中
**解决**：

- 开发阶段用 `npx -y @modelcontextprotocol/server-filesystem`
- 生产打包时，将 server-filesystem 作为本地依赖安装
- 使用 `node` 直接运行：

```ts
const transport = new StdioClientTransport({
  command: "node",
  args: [require.resolve("@modelcontextprotocol/server-filesystem/dist/index.js"), mountPath],
});
```

### 4. react-reader 样式泄漏

**问题**：epub.js 的默认样式可能与 TailwindCSS 冲突
**解决**：将 ReactReader 包裹在一个有 `style={{ isolation: "isolate" }}` 的容器中

### 5. @xenova/transformers vs @huggingface/transformers

**问题**：v2 (@xenova) 和 v3 (@huggingface) API 有细微差异
**宪法指定 v2**，但如果遇到不维护的问题：

- v3 改名了包：`@huggingface/transformers`
- v3 的 `pipeline` 返回类型略有变化
- v3 支持 WebGPU 加速（未来可用）

## ⚠️ 中优先级

### 6. Electron IPC 序列化限制

- IPC 传输的数据必须是可序列化的（Structured Clone Algorithm）
- **不能**传 `Function`、`Symbol`、`WeakMap`
- 大文件（epub ArrayBuffer）传输时注意性能，考虑分块

### 7. Zustand persist + Electron

- 使用 `localStorage` persist 在 Electron 中工作正常
- 但 `IndexedDB` persist 在某些 Electron 版本中有限制
- 建议：Zustand 简单状态用 localStorage，RAG 索引用 IndexedDB（在 Worker 中操作）

### 8. Vite + Electron 双构建

- 推荐使用 `electron-vite` 或 `vite-plugin-electron`
- 主进程用 CJS/ESM，渲染进程用 ESM
- tsconfig 需要分别配置（tsconfig.json + tsconfig.node.json）

## 🔧 验证期间发现的问题（已修复）

> 以下问题在 2026-02-09 全量验证 (16 changes) 中发现并已修复。

### 9. MCP Manager `_convertToFileEntry` 使用 `any` 类型

**问题**：`_convertToFileEntry(item: any)` 违反宪法 TypeScript strict 规则
**修复**：改为 `_convertToFileEntry(item: unknown)` + `Record<string, unknown>` 类型守卫

```ts
// ✅ 正确模式
private _convertToFileEntry(item: unknown): BookFile {
  const record = item as Record<string, unknown>;
  return {
    name: typeof record.name === 'string' ? record.name : 'unknown',
    // ...
  };
}
```

### 10. RAG Worker 并发搜索竞态条件

**问题**：`persona-generator.ts` 中 `Promise.all([searchRag(...), searchRag(...), searchRag(...)])` 三个并发 search 消息，Worker 返回时无法区分哪个响应对应哪个请求
**修复**：在 `rag-types.ts` 的 `SearchMessage` / `StatusMessage` 增加可选 `requestId` 字段，Worker 透传，调用方用唯一 ID 匹配响应

```ts
// 消息类型增加 requestId
interface SearchMessage { type: 'search'; bookId: string; query: string; topK?: number; requestId?: string; }
interface SearchResultResponse { type: 'search:result'; results: SearchResult[]; requestId?: string; }

// 调用方匹配
const requestId = `search_${++counter}_${Date.now()}`;
worker.postMessage({ type: 'search', bookId, query, topK: 5, requestId });
// 监听时 filter: result.requestId === requestId
```

### 11. shadcn/ui ScrollArea 滚动事件捕获

**问题**：`ChatInterface.tsx` 的 `<ScrollArea>` 内部 div 上绑定 `onScroll` 无法捕获到 Radix ScrollArea 的 viewport 滚动事件，导致"滚到底部自动跟随"失效
**原因**：Radix ScrollArea 内部创建了一个 viewport div 来处理滚动，外层 div 并不滚动
**修复**：改用 `onScrollCapture` 在 `<ScrollArea>` 上捕获事件，从 `e.target` 读取滚动位置

```tsx
// ✅ 正确做法
<ScrollArea onScrollCapture={handleScroll}>
  <div ref={scrollContainerRef}>
    {messages.map(...)}
  </div>
</ScrollArea>

const handleScroll = (e: React.UIEvent) => {
  const target = e.target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = target;
  // ...
};
```

## 📋 已知限制（暂不修复）

### Phase 2 IPC-MCP 桥接未完成

- `ipc-handlers.ts` 中的 MCP 相关 handlers 使用 placeholder 响应
- 需要 `ipc-mcp-bridge` change 来接入真实 McpManager
- 影响：书架挂载/文件操作功能不可用于真实文件系统

### 测试覆盖率

- 无单元测试框架（Vitest）配置
- 当前依赖 Copilot Agent Skill 进行结构化验证
- 后续应补充关键路径的自动化测试
