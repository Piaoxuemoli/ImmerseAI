# ImmerseAI 已知坑 & 排雷手册

## 🚨 高优先级（开发前必须知道）

### 1. Transformers.js + Electron + Vite Worker 兼容性
**问题**：@xenova/transformers 在 Vite 的 Web Worker 中可能报 `SharedArrayBuffer is not defined`
**原因**：Electron 的渲染进程默认没有启用 `crossOriginIsolated`
**解决**：
```ts
// electron/main/index.ts 中配置
const win = new BrowserWindow({
  webPreferences: {
    // ...
  },
});

// 设置响应头启用 SharedArrayBuffer
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
