# ImmerseAI Bug 调试记录

> 技术栈：React + TypeScript + Electron | 项目：ImmerseAI
> 本文档记录开发过程中遇到的 bug，包含根因分析、解决方案与面向面试的知识总结。

---

## BUG-001: 从阅读器返回书架后书架内容丢失

**日期**: 2026-03-05 | **技术栈**: React / Zustand / React Router | **严重程度**: 高 | **状态**: 已修复

### 问题发现

操作步骤：
1. 启动应用，书架正常显示书籍列表
2. 点击任意书籍封面，跳转至 `/reader/:id` 阅读器页面
3. 点击阅读器左上角返回按钮（`ArrowLeft`），导航回 `/bookshelf`
4. 书架页面显示**空白**，书籍列表消失，状态表现为"未连接"或"加载中"永不结束

### 问题描述

用户从阅读器返回书架后，原本已加载完成的书架内容（书籍卡片、文件夹列表）全部消失，页面变为空白或展示"选择书架目录"的初始引导界面，需要用户重新手动选择目录才能恢复，严重影响核心使用流程。

### 根因分析

问题由两个独立因素共同造成，缺一不可：

**原因一：组件卸载导致本地状态清空**

`BookshelfPage` 中的 `rootEntries`（目录树数据）和 `activeFolderPath`（当前激活文件夹路径）使用 `useState` 管理，属于**组件本地状态**。当用户跳转到阅读器页面时，`BookshelfPage` 组件被 React Router **完全卸载（unmount）**，其本地状态随之销毁。返回时组件重新挂载，这两个状态被重置为初始空值。

```tsx
// BookshelfPage.tsx — 这两个状态在组件卸载时会被销毁
const [activeFolderPath, setActiveFolderPath] = useState('')       // 重置为空字符串
const [activeFolderEntries, setActiveFolderEntries] = useState<BookFile[]>([])  // 重置为空数组
```

**原因二：autoConnect() 因连接状态判断直接 return，不重新加载数据**

组件挂载时调用 `autoConnect()`，其内部有前置守卫条件：

```ts
// useBookshelf.ts
const autoConnect = useCallback(async () => {
  if (!bookshelfRootPath || connectionStatus !== 'disconnected') return  // ← 关键
  // ...
}, [bookshelfRootPath, connectionStatus, ...])
```

`connectionStatus` 存储在 **Zustand 全局 store** 中（运行时状态，不持久化），从阅读器返回时它的值仍然是 `'connected'`（MCP 连接并未断开）。因此 `autoConnect()` 的条件 `connectionStatus !== 'disconnected'` 不成立，函数**提前 return**，`rootEntries` 永远不会被重新填充。

**两个原因的叠加效应**：
- `rootEntries` 为空 → 渲染逻辑判断 `rootEntries.length === 0` → 显示"空书架"界面
- `autoConnect()` 跳过 → 没有任何机制触发重新加载

```
组件重挂载
    │
    ├── useState 重置：rootEntries = [], activeFolderPath = ''
    │
    └── useEffect → autoConnect()
            │
            └── connectionStatus === 'connected' → return（不执行任何加载）
                    │
                    └── rootEntries 永远为空 → 书架显示空白 ❌
```

### 解决方案

**修改文件**: `src/features/bookshelf/BookshelfPage.tsx`

在挂载 `useEffect` 中增加判断：若当前已处于 `'connected'` 状态，直接调用 `refreshBooks()` 重新加载目录树和书籍列表，跳过不必要的重连流程。

```diff
- // 应用启动时若有已保存路径则自动重连
  useEffect(() => {
-   autoConnect()
+   if (connectionStatus === 'connected') {
+     refreshBooks()
+   } else {
+     autoConnect()
+   }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

`refreshBooks()` 内部调用 `loadBookshelfData()`，后者会重新执行 `scanBooksRecursively()` 并调用 `setRootEntries()`，从而恢复本地状态。

**为什么不用 `navigate(-1)` 或保留组件状态**：
- 返回按钮已使用 `navigate('/bookshelf')` 硬跳转，改为 `navigate(-1)` 会影响前进/后退栈的语义
- 将 `rootEntries` 提升到全局 store 是另一种方案，但会引入不必要的持久化开销；`refreshBooks()` 在重连时本就需要执行，此方案成本更低

### 解决效果

修复后，用户从阅读器返回书架时，页面立即触发 `refreshBooks()`，书籍列表和文件夹结构正常还原，无需用户任何额外操作。行为与首次进入书架一致。

---

### 涉及知识点

**React 组件卸载与本地状态生命周期**

React 中，通过路由切换（如 `navigate('/reader/:id')`）离开某个页面时，该页面的组件会被**完全卸载**（unmount），其所有 `useState` 持有的本地状态随之销毁，内存被回收。当用户返回该页面时，组件重新挂载，`useState` 从初始值重新开始。这与 `display: none` 隐藏（组件仍挂载、状态保留）截然不同。要在路由切换间保留数据，必须将状态提升到全局 store（如 Zustand）或父组件，或在重新挂载时主动重新获取数据。

**Zustand 全局状态 vs 组件本地状态的生命周期差异**

Zustand store 是模块级单例，其状态在整个应用生命周期内持续存在，不受任何组件的挂载/卸载影响。而 `useState` 的状态与组件实例绑定，组件销毁则状态清除。在 Electron 应用中，MCP 连接状态（`connectionStatus`）存放在 Zustand 中，即使书架组件卸载后，连接状态仍为 `'connected'`，这一"跨生命周期持久"的特性既是优势（不需重连），也需要开发者在组件重挂载时主动识别并同步本地状态。

**useEffect 依赖数组为空时的闭包快照**

`useEffect(() => { ... }, [])` 仅在组件**挂载时**执行一次，其回调函数通过**闭包**捕获了组件挂载那一刻的变量快照。本例中，`connectionStatus` 的值在 `useEffect` 回调创建时（即组件挂载瞬间）已被捕获，后续 store 的变化不会影响这个已执行的 effect。正因如此，组件重挂载时读取到的 `connectionStatus` 是最新的 `'connected'`，这个行为是预期且正确的——关键在于利用这个快照做出正确的分支判断（`refreshBooks()` vs `autoConnect()`）。

**React Router 路由导航与组件挂载/卸载的关系**

React Router v6 中，当路由路径发生变化时，离开路径对应的路由组件会被**卸载**，新路径对应的组件被**挂载**。`navigate('/bookshelf')` 是命令式跳转，效果等同于用户在地址栏输入新 URL。每次导航到 `/bookshelf` 都会触发 `BookshelfPage` 的完整挂载周期（constructor → render → useEffect），而非仅触发更新（re-render）。

---

### 面试问答

**Q: React 中组件切换时本地状态丢失，有哪些解决方案？各自的适用场景是什么？**

> 主要有三种方案：
> 1. **状态提升到全局 store（Zustand/Redux）**：适用于需要跨页面共享或持久化的状态，如用户配置、连接状态。代价是增加 store 复杂度。
> 2. **重新挂载时主动获取数据**：适用于可以廉价重新获取的数据（如从服务器/本地文件系统读取目录列表）。通过在 `useEffect([], [])` 中检测上下文（如已连接则直接刷新），无需持久化中间状态。
> 3. **用 CSS 隐藏组件而非卸载**（`display: none` / React 18 `<Activity>`）：适用于切换频繁且状态难以重建的场景（如编辑器草稿）。代价是保留了 DOM 节点，内存占用更高。
> 本 bug 的修复采用方案 2，因为 `rootEntries` 可以通过 MCP 低成本重新获取，无需持久化。

**Q: Zustand 的 `persist` 中间件和普通 `useState` 在 Electron 应用中分别适合存储什么类型的数据？**

> `persist`（写入 `localStorage`）适合存储**用户配置类数据**：书架根路径（`bookshelfRootPath`）、LLM 配置（`llmConfig`）、书籍元数据列表（`books`）等——这些数据在 Electron 重启后仍需恢复。不适合存储**运行时状态**（`connectionStatus`、`isGenerating`）或**可廉价重建的派生数据**（`rootEntries`、`activeFolderPath`）：前者每次启动需要重新建立，后者在组件挂载时从文件系统重新读取即可，持久化反而会引入数据陈旧问题。原则是：持久化"原始数据"，运行时重建"派生视图"。

**Q: 如何在 React 中安全地在 `useEffect` 内判断"组件是否是首次挂载还是重新挂载后的刷新"？**

> 严格来说，React 无法直接区分"首次挂载"和"路由返回后的重挂载"，因为每次都会触发完整的挂载生命周期。实际解决方式是**判断业务状态而非组件生命周期阶段**：读取全局 store 中的状态（如 `connectionStatus`），根据业务含义做分支处理——已连接则刷新数据，未连接则执行重连。这比试图区分"挂载次数"更健壮，因为业务状态的语义是明确的。另一种模式是使用 `useRef` 记录是否是首次挂载（`const isFirstMount = useRef(true)`），但这种方案在严格模式（StrictMode）下会失效，因为 React 18 StrictMode 会故意 mount → unmount → remount 来检测副作用纯度。

---
