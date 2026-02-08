## Context

ImmerseAI 是一个 Local-First 的桌面应用，需要：
- 访问本地文件系统（书籍管理）
- 运行计算密集型 ML 模型（RAG 向量化）
- 调用远程 LLM API
- 提供流畅的用户界面

**当前状态**: 仅有文档和规范，无可运行代码。

**约束**:
- 必须遵守项目宪法的三大核心原则（数据主权、UI 零阻塞、Agentic 能力）
- 所有 ML 计算必须在 Web Worker 中执行
- IPC 通信必须安全，禁止渲染进程直接访问 Node.js API
- UI 必须遵循 Notion 极简风格（TailwindCSS + shadcn/ui）

**参考资料**:
- `docs/dependencies.json` - 完整依赖清单
- `docs/spikes/` - 技术验证代码
- `docs/known-issues.md` - 已知兼容性问题
- `.github/copilot-instructions.md` - 项目宪法

## Goals / Non-Goals

**Goals:**
- 建立可运行的 Electron + React 项目骨架
- 配置符合宪法约束的安全架构（双进程 + Worker）
- 集成 UI 系统（TailwindCSS + shadcn/ui）
- 建立清晰的目录结构和代码组织规范
- 配置开发工具链（TypeScript strict, ESLint, Prettier）
- 确保 Transformers.js 能在 Worker 中正常运行（Cross-Origin headers）

**Non-Goals:**
- 实现任何业务功能（书架、阅读器、对话等）
- 集成 MCP SDK 或 LLM API（Phase 2-4 的工作）
- 编写测试（当前阶段仅关注基础设施）
- 优化性能或打包体积（后续迭代处理）

## Decisions

### D1: 构建工具 — electron-vite

**选择**: electron-vite  
**备选**: electron-forge, electron-builder + vite-plugin-electron

**理由**:
- **官方支持**: Vite 团队维护，与 Vite 生态无缝集成
- **双进程统一配置**: 主进程和渲染进程共用一套 Vite 配置，简化开发
- **Worker 支持**: 原生支持 Web Worker，无需额外配置
- **热重载**: 主进程和渲染进程都支持 HMR
- **TypeScript 优先**: 内置 TypeScript 支持，无需额外配置

**影响**: 
- `electron.vite.config.ts` 作为统一配置入口
- 主进程代码放在 `electron/main/`，渲染进程在 `src/`

---

### D2: IPC 安全策略 — contextBridge + 白名单 channel

**选择**: preload 脚本通过 contextBridge 暴露受限 API  
**备选**: 启用 nodeIntegration（**违宪**）

**理由**:
- **安全性**: nodeIntegration=false + contextIsolation=true 是 Electron 官方推荐
- **攻击面最小化**: 渲染进程无权限直接调用 Node.js API，防止 XSS 攻击
- **类型安全**: preload 暴露的 API 可完整定义 TypeScript 类型

**实现细节**:
```ts
// electron/preload/index.ts
contextBridge.exposeInMainWorld('electronAPI', {
  listFiles: (path: string) => ipcRenderer.invoke('mcp:listFiles', path),
  // ... 其他白名单 API
});
```

**影响**:
- 所有 IPC 调用必须预先在 preload 中定义
- 主进程需通过 `ipcMain.handle` 注册对应 channel

---

### D3: UI 框架 — React 18 + react-router-dom v6

**选择**: React 18 Functional Components + Hooks  
**备选**: Vue, Svelte, Solid

**理由**:
- **生态成熟**: shadcn/ui 基于 React（Radix UI primitives）
- **Hooks 简洁**: 状态管理（Zustand）、副作用处理更直观
- **团队熟悉度**: AI 辅助编程对 React 代码生成质量最高
- **路由成熟**: react-router-dom v6 支持嵌套路由和动态参数

**约束**:
- **禁止 Class Components**（宪法规定）
- 所有组件必须是函数式组件 + Hooks

---

### D4: 样式系统 — TailwindCSS + shadcn/ui

**选择**: TailwindCSS 原子化 + shadcn/ui 无头组件  
**备选**: CSS Modules, Styled Components, Chakra UI

**理由**:
- **原子化**: 符合 Notion 极简风格，避免 CSS 冗余
- **shadcn/ui**: 可复制粘贴的组件代码（非 npm 包），完全可控
- **Radix UI 底层**: 无障碍访问（A11y）开箱即用
- **与宪法一致**: 宪法已明确指定 TailwindCSS + shadcn/ui

**配置要点**:
```ts
// tailwind.config.ts
theme: {
  colors: {
    primary: 'slate-900',  // #0f172a
    border: 'slate-200',   // #e2e8f0
    // 按宪法定义配置色板
  }
}
```

---

### D5: 目录结构 — Feature-based 分层

**选择**: Feature-based（按功能模块划分）  
**备选**: Layer-based（按技术层划分，components/hooks/services）

**理由**:
- **高内聚**: 同一功能的组件、hooks、store 放在一起
- **可维护性**: 新功能开发时只需关注一个 feature 目录
- **符合宪法**: 宪法第七章已定义目录结构

**结构**:
```
src/
├── features/
│   ├── bookshelf/     # 书架功能（完整独立）
│   ├── reader/        # 阅读器
│   ├── chat/          # 对话
│   └── persona/       # 角色管理
├── shared/
│   ├── components/ui/ # shadcn/ui 组件
│   ├── hooks/         # 跨 feature 的 hooks
│   └── types/         # 全局类型定义
```

---

### D6: Worker 支持 — Vite Worker + Cross-Origin headers

**选择**: Vite 原生 Worker + 主进程设置 COOP/COEP headers  
**备选**: 不启用 SharedArrayBuffer（性能损失）

**理由**:
- **Transformers.js 需求**: 模型加载需要 SharedArrayBuffer
- **浏览器安全要求**: SharedArrayBuffer 必须在 crossOriginIsolated 环境
- **Electron 实现**: 主进程拦截响应头即可启用

**实现**（参考 `docs/known-issues.md` #1）:
```ts
// electron/main/index.ts
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

**影响**:
- 所有外部资源（fonts, CDN）需确保 CORS 正确配置
- Worker 中的 Transformers.js 可正常使用 WASM

---

### D7: TypeScript 配置 — strict mode + 双 tsconfig

**选择**: TypeScript strict mode, 主进程和渲染进程分别配置  
**备选**: 宽松模式（违宪）

**理由**:
- **类型安全**: strict mode 强制处理 null/undefined，减少运行时错误
- **宪法要求**: 明确禁止 `any` 类型
- **双配置**: 主进程（Node.js）和渲染进程（DOM）环境不同

**配置**:
- `tsconfig.json` - 渲染进程（React, DOM）
- `tsconfig.node.json` - 主进程（Node.js, Electron）

## Risks / Trade-offs

### R1: electron-vite 生态相对较新
**Risk**: 社区插件和文档不如 electron-forge 丰富  
**Mitigation**: 
- electron-vite 由 Vite 团队维护，质量有保证
- 主流用例已覆盖，复杂需求可直接配置 Vite

### R2: shadcn/ui 组件需要手动复制
**Risk**: 组件更新需手动同步，无法 `npm update`  
**Trade-off**: 
- 优势：完全可控，可按需修改组件代码
- 缓解：shadcn/ui 组件相对稳定，更新频率低

### R3: Cross-Origin headers 可能影响外部资源加载
**Risk**: 第三方 CDN 资源（字体、图片）可能因 CORP 限制加载失败  
**Mitigation**: 
- 使用本地字体（Inter 打包在项目中）
- 避免依赖外部 CDN，所有资源本地化

### R4: Feature-based 结构初期目录较多
**Risk**: 项目初期功能少时，目录显得"过度设计"  
**Trade-off**: 
- 优势：长期维护性好，避免后期重构
- 缓解：可先创建骨架目录，实现时再填充

### R5: TypeScript strict mode 增加初期开发成本
**Risk**: 类型定义工作量大，尤其是 IPC 通信的类型  
**Trade-off**: 
- 优势：避免大量运行时类型错误，提升代码质量
- 缓解：先定义好 `shared/types/index.ts`，后续复用
