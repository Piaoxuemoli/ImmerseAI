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

## BUG-002: 书籍导入功能完全不可用（三轮调试）

**日期**: 2026-03-05 | **技术栈**: Electron IPC / MCP / Node.js fs | **严重程度**: 高 | **状态**: 已修复

### 问题发现

用户尝试通过 TopBar 按钮向书架导入 `.md` / `.txt` 文件：
1. 点击 TopBar 右侧的文件按钮
2. 期望弹出文件选择对话框，选择本地文件后导入到当前书架目录
3. 实际结果：**无法添加书籍**（第一轮）、**选择文件后报错**（第二轮）、**成功**（第三轮修复后）

### 问题描述

书籍导入功能经历了三轮连续调试才最终修复，每轮暴露一个不同的问题层次：

- **第一轮**：按钮图标和功能语义完全错误——TopBar 的"下载"图标实际执行的是"重新挂载书架根目录"操作，用户无从添加书籍
- **第二轮**：修复语义后，`.md`/`.txt` 文件在目录扫描时被 IPC handler 过滤掉，书架无法识别这类文件
- **第三轮**：导入逻辑错误地通过 MCP `readFile` 读取用户选择的外部文件，触发 MCP 沙箱安全限制，报 Access Denied

### 根因分析

**第一轮：按钮语义错误**

TopBar 的 `Download` 图标按钮绑定的是 `mountBookshelf()`，该函数弹出的是**文件夹**选择对话框，用于重新挂载整个书架根目录，而不是导入单本书籍。用户点击后要么选不到文件，要么触发书架重置，无法完成导入。这是功能定义层面的错误。

**第二轮：mcp:list-files handler 过滤了 unknown 类型**

修复按钮语义后，发现书架完全无法扫描到 `.md` / `.txt` 文件。原因在于 `ipc-handlers.ts` 的 `mcp:list-files` handler：

```ts
// 问题代码 — electron/main/ipc-handlers.ts
const entries = await McpManager.getInstance().listFiles(filePath)
return entries
  .filter((e) => e.type !== 'unknown')  // ← 在 convertToBookFile 之前就过滤掉了
  .map(convertToBookFile)
```

MCP filesystem server 对 `.md`/`.txt` 文件返回的 `type` 字段是 `'unknown'`（该 server 只内置识别 `directory` 等少数类型）。`convertToBookFile` 函数虽然能根据扩展名将 `unknown` 转为 `md`/`txt`，但过滤在前，这段代码从未执行到。

**第三轮：MCP 沙箱安全边界**

实现导入逻辑时，用 `window.electronAPI.mcp.readFile(filePath)` 读取用户在系统任意位置选择的文件。MCP filesystem server 有严格的路径沙箱——**只允许访问挂载时指定的根目录**（`test_book`）。读取 `C:\Users\xxx\Desktop\三体.txt` 这类外部路径时，MCP 直接拒绝并抛出 Access Denied。

```
Error: readFile failed: Error: Access denied - path outside allowed directories:
  C:Users26937Desktop三体.txt not in c:users26937desktopimmerseaitest_book
```

MCP 的设计本意是只操作书架内的文件，读取外部文件本不是它的职责范围。

### 解决方案

**第一轮修复**：重新设计 TopBar 导入按钮

将 `onImportClick` 从 `mountBookshelf` 改为 `handleImportBooks`，图标改为 `FilePlus`，tooltip 改为"导入书籍到当前文件夹"。书架根目录挂载仅保留在未连接引导界面，不在 TopBar 暴露。

**第二轮修复**：移除 IPC handler 中的过滤逻辑

```diff
// electron/main/ipc-handlers.ts
  const entries = await McpManager.getInstance().listFiles(filePath)
- return entries
-   .filter((e) => e.type !== 'unknown')
-   .map(convertToBookFile)
+ return entries.map(convertToBookFile)
```

`convertToBookFile` 已有根据扩展名推断类型的逻辑，无需提前过滤。

**第三轮修复**：新增 `app:read-file-text` IPC handler，绕过 MCP 沙箱读取外部文件

```diff
// 导入逻辑 — BookshelfPage.tsx
- const buffer = await window.electronAPI.mcp.readFile(filePath)  // MCP 沙箱拒绝
- const text = new TextDecoder().decode(buffer)
+ const text = await window.electronAPI.app.readFileText(filePath)  // 主进程 fs，无限制
  await window.electronAPI.mcp.writeFile(destPath, text)           // 写入书架 ✅
```

主进程新增 handler：

```ts
// electron/main/ipc-handlers.ts
ipcMain.handle('app:read-file-text', async (_event, filePath: string): Promise<string> => {
  return await fs.readFile(filePath, 'utf-8')
})
```

读写职责分离：读取外部文件走主进程 `fs`（无路径限制），写入书架走 MCP（受控沙箱），两者各司其职。

### 解决效果

三轮修复后，点击 `FilePlus` 按钮弹出多选文件对话框，选择任意位置的 `.md`/`.txt` 文件，内容被复制到当前激活的书架子目录，成功 toast 提示并自动刷新书架视图。

---

### 涉及知识点

**Electron 进程模型与 IPC 安全边界**

Electron 应用分为主进程（Node.js 环境，可访问文件系统）和渲染进程（Chromium 沙箱，无法直接访问 Node.js API）。两者通过 `ipcMain.handle` / `ipcRenderer.invoke` 通信。渲染进程只能调用 preload 通过 `contextBridge` 暴露的白名单 API，不能随意访问主进程能力。这个边界既是安全保障，也意味着需要为每种"特权操作"单独设计 IPC channel。

**MCP Filesystem Server 的沙箱机制**

MCP（Model Context Protocol）filesystem server 在启动时接受一个根目录参数，之后所有文件操作（读/写/列目录）都受该根目录约束——任何试图访问根目录外路径的请求都会被拒绝并返回 Access Denied。这个设计保证了 AI Agent 的文件操作权限可控，但也意味着它**不能**作为通用文件读取工具使用，必须与主进程的 `fs` 模块配合，各司其职。

**类型转换应在过滤之前完成**

代码中存在一个常见的顺序错误：先 `.filter()` 再 `.map()` 转换类型，导致 filter 时的判断条件基于原始类型（`'unknown'`），而非转换后的业务类型（`'md'`/`'txt'`）。正确做法是先 `.map()` 完成类型标准化，再基于标准化后的类型进行 `.filter()`，或者在 `.map()` 内部做兜底处理后统一过滤不支持的类型。

**多轮调试的分层思路**

本次 bug 跨越三个层次：UI 语义层（按钮职责错误）→ IPC 数据层（类型被过滤）→ 安全架构层（沙箱边界）。每一层修复后才暴露下一层的问题。这提示在设计功能时需要自顶向下完整考虑：UI 意图是否准确、数据管道是否完整、安全边界是否匹配——缺少任何一层的验证都会导致功能失效。

---

### 面试问答

**Q: Electron 中主进程与渲染进程的职责边界是什么？为什么不能在渲染进程中直接调用 Node.js `fs` 模块？**

> Electron 的渲染进程运行在 Chromium 沙箱中，出于安全考虑默认禁用 Node.js 集成（`nodeIntegration: false`）。即使开启也存在 XSS 漏洞风险——恶意脚本可直接操作文件系统。正确做法是：渲染进程通过 `contextBridge` 暴露的白名单 IPC API 发起请求，主进程执行实际的文件操作后返回结果。这样即使渲染进程被攻击，攻击者也只能调用预定义的有限操作，无法任意访问文件系统。本项目中 `app:read-file-text` 就是这种模式：渲染进程传入路径，主进程用 `fs.readFile` 执行，不暴露完整的 `fs` 能力。

**Q: 如果一个功能在三个不同层次都有 bug（UI、数据管道、安全边界），你会如何系统地排查和修复？**

> 分层排查的关键是**建立可观测点**：首先在 UI 层确认操作意图是否正确（按钮触发的是预期函数）；其次在数据层打印 IPC 调用的入参和返回值（确认数据没有在管道中意外丢失或变形）；最后在系统边界层查看报错信息（Access Denied 这类错误通常直接指向权限/沙箱问题）。每修复一层后立即验证该层是否通过，再继续下一层，避免多处同时修改引入新的问题。本次调试就是这个顺序：先修按钮语义确认 UI 路径正确，再修 IPC filter 确认数据能传递，最后修读取方式解决沙箱限制。

**Q: MCP（Model Context Protocol）的沙箱设计对 AI Agent 的文件操作安全有什么意义？**

> MCP filesystem server 的根目录约束是一种**最小权限原则（Principle of Least Privilege）**的实现：AI Agent 只能操作用户显式授权的目录，无法读取系统文件、用户隐私数据或其他应用数据。这对 Local-First 应用尤为重要——用户把书库目录授权给 Agent 管理，Agent 就只能在这个"笼子"里操作，即使 LLM 产出了恶意指令（如 `delete_file: C:/Windows/System32`），MCP 也会在执行前拦截。这与 Electron 的 `contextIsolation` 设计理念一致：通过架构约束而非运行时检查来保证安全。

---

## BUG-003: RAG 系统连环崩溃——file:// 协议封锁 + 模型路径错误 + 缓存陈旧 + 大文档超时

**日期**: 2026-03-07 | **技术栈**: Electron IPC / Web Worker / @huggingface/transformers / @orama/orama / Node.js | **严重程度**: 高 | **状态**: 已修复

### 问题发现

操作步骤：
1. 打开任意一本书籍，切换到 Chat 模式触发 RAG 构建
2. DevTools 控制台出现 `Not allowed to load local resource: file:///...tokenizer.json`，RAG 降级为词法检索
3. 修复后再次运行，日志显示 `Cache hit`，但缓存是上一次降级运行的残留（lexical 模式），语义搜索仍无法使用
4. 点击"生成人设"，报错 `BOOK_NOT_INDEXED`，人设生成完全不可用
5. 对《凡人修仙传》（约 800 万字）测试，构建时间超过 20 分钟，前端无任何进度提示，用户无法感知

### 问题描述

RAG 系统出现级联失败：首先是语义模型在渲染进程 Web Worker 中无法加载本地文件，被迫降级为纯词法搜索；接着是陈旧的词法缓存阻止了正常的语义重建；随后是 `BOOK_NOT_INDEXED` 错误导致人设生成功能完全不可用；最后是超大书籍的索引时间过长（20+ 分钟），且前端毫无进度反馈，用户体验极差。

### 根因分析

本次 bug 由四个相互关联的独立原因层叠造成：

**原因一：Web Worker 的 `file://` 协议被 Chromium 安全沙箱阻断**

原始 RAG 实现在渲染进程的 Web Worker 中运行，通过 `@huggingface/transformers` 加载本地 ONNX 模型文件：

```ts
// 原始 rag.worker.ts — 渲染进程 Web Worker 中
env.localModelPath = 'file:///C:/Users/.../resources/models/'
const pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
```

Chromium 对 Web Worker 中的 `file://` 协议有严格限制——渲染进程（含 Worker）被视为"网页上下文"，加载本地任意文件存在安全风险，因此被拦截并抛出 `Not allowed to load local resource` 错误。

**原因二：模型量化文件名不匹配**

将 RAG 迁移到主进程后，`@huggingface/transformers` 默认尝试加载 `model.onnx`，而实际下载的量化模型文件名为 `model_quantized.onnx`。配置项错误（使用了 `quantized: true` 而非 `dtype: 'q8'`）导致文件名不匹配，模型依然无法加载：

```ts
// 错误配置
const extractor = await pipeline('feature-extraction', modelId, { quantized: true })
// 正确配置
const extractor = await pipeline('feature-extraction', modelId, { dtype: 'q8' })
```

**原因三：陈旧 lexical 缓存命中，阻止语义重建**

模型成功加载后，系统检测到已有缓存（上一次降级运行写入的 `mode: 'lexical'` 缓存），直接命中返回，跳过了本该执行的语义向量构建。用户视角：RAG"已完成"，但实际上没有语义向量。

**原因四：`ReaderPage` 中的提前返回守卫引发版本升级后的虚假"已索引"状态**

```tsx
// 问题代码 — ReaderPage.tsx
useEffect(() => {
  if (book.isIndexed && book.contentHash) return  // ← 危险：仅检查 store 元数据
  ensureIndexed()
}, [book.id])
```

`CACHE_VERSION` 从 2 升级到 3 时，磁盘上的旧缓存文件被自动删除，但 Zustand store（persist 持久化）中的 `book.isIndexed = true` 和 `book.contentHash` 仍然存在。组件挂载时，这个守卫条件成立，`ensureIndexed()` 被跳过，系统认为书已索引，但物理缓存文件不存在，导致 `ragSearch` 找不到缓存而抛出 `BOOK_NOT_INDEXED`。

**原因五：大文档全量语义索引耗时过长，无反馈**

《凡人修仙传》约 800 万字，自适应分块后产生约 4000 个 chunk，逐一生成 384 维向量需要 20+ 分钟，整个过程在主进程同步执行，UI 完全冻结且无任何进度信息，用户无法感知是否在运行。

### 解决方案

**修改文件**: `electron/main/rag-handler.ts`, `electron/preload/index.ts`, `src/shared/types/electron.d.ts`, `src/shared/hooks/useRag.ts`, `src/features/reader/ReaderPage.tsx`, `src/features/reader/components/ReaderHeader.tsx`

**Fix 1：将 RAG 从 Web Worker 迁移到主进程**

彻底删除 `src/workers/rag.worker.ts` 和 `src/shared/hooks/useRagWorker.ts`，在 `electron/main/rag-handler.ts` 中重新实现全部 RAG 逻辑（分块、向量化、搜索、缓存）。主进程是 Node.js 环境，`file://` 限制不适用。

**Fix 2：使用 `dtype: 'q8'` 正确指定量化模型**

```diff
- const extractor = await pipeline('feature-extraction', modelId, { quantized: true })
+ const extractor = await pipeline('feature-extraction', modelId, { dtype: 'q8' })
```

**Fix 3：实现自适应分块（Adaptive Chunking）**

```ts
export function adaptiveChunkSize(totalChars: number): { chunkSize: number; chunkOverlap: number } {
  let chunkSize: number
  if (totalChars < 200_000)        chunkSize = 500
  else if (totalChars < 2_000_000) chunkSize = 1_000
  else if (totalChars < 10_000_000) chunkSize = 2_000
  else                              chunkSize = 4_000
  const chunkOverlap = Math.max(50, Math.floor(chunkSize * 0.1))
  return { chunkSize, chunkOverlap }
}
```

**Fix 4：两阶段索引 + 语义采样（Two-Phase Indexing）**

对大书（`chunks.length > SEMANTIC_FULL_THRESHOLD`）立即完成词法索引（Phase 1）发送 `rag:ingest-complete(mode:'lexical')`，书立即可用。随后 `setImmediate` 触发后台语义升级（Phase 2）：对 chunks 做头/中/尾采样（最多 10k 个），逐批生成向量，每批通过 `rag:upgrade-progress` 向前端汇报进度，完成后保存 `mode:'hybrid'` 缓存并发送 `rag:upgrade-complete`。

**Fix 5：混合检索 RRF（Hybrid Search with Reciprocal Rank Fusion）**

```ts
// RRF score = Σ 1/(k + rank_i)，k=60
function hybridSearch(cache, query, topK) {
  // 语义子集（采样 chunks）和全量词法分别排序后 RRF 融合
}
```

**Fix 6：删除 `ReaderPage` 中的提前返回守卫**

```diff
  useEffect(() => {
-   if (book.isIndexed && book.contentHash) return
    ensureIndexed()
  }, [book.id])
```

改为始终调用 `ensureIndexed()`（内部走 IPC 验证物理缓存是否存在），确保版本升级后正确触发重索引。

**Fix 7：`CACHE_VERSION` 升至 3，旧缓存自动清理**

```diff
- const CACHE_VERSION = 2
+ const CACHE_VERSION = 3
```

加载缓存时检测版本号，若不匹配则删除旧文件并重新索引，彻底解决陈旧缓存命中问题。

### 解决效果

- 语义模型正常加载，向量检索可用
- 小书（< 5000 chunks）：一次性完成语义索引，约 30 秒内完成
- 大书（如《凡人修仙传》800 万字）：词法索引 < 10 秒即可使用，ReaderHeader 显示语义升级进度条，升级完成后自动切换到混合搜索
- `BOOK_NOT_INDEXED` 错误彻底消失，人设生成正常
- 版本升级后旧缓存自动失效，不再出现陈旧缓存命中

---

### 涉及知识点

**Electron 渲染进程 / Web Worker 的 `file://` 安全限制**

Electron 渲染进程（含其内部创建的 Web Worker）本质上是 Chromium 浏览器上下文，受同源策略和本地资源加载限制约束。从 `file://` URL 加载模型文件属于"加载任意本地文件"操作，Chromium 将其视为安全风险并拦截。主进程是 Node.js 环境，`fs.readFile` 没有此限制。对于需要访问本地文件的重计算任务，正确架构是将其放在主进程（通过 IPC 与渲染进程通信），而非 Web Worker。

**两阶段索引与 Reactive 进度反馈**

对于耗时操作，用户等待体验的关键在于"让功能尽快可用"而非"等待完美结果"。两阶段策略：Phase 1 以较低质量（词法）快速完成，立即通知前端可用；Phase 2 在后台异步升级质量（语义/混合），通过进度事件（`rag:upgrade-progress`）保持前端感知。这是一种 Optimistic Concurrency 的思想延伸——先给用户一个"能用的"答案，再悄悄换成"更好的"答案。

**Zustand persist 与物理文件状态的一致性问题**

Zustand `persist` 中间件将 store 序列化到持久化存储（如 Electron 的 `electronStore`）。当依赖 store 中的元数据（如 `isIndexed: true`）来判断物理文件是否存在时，存在隐患：store 快照不随文件系统变化而更新（版本升级、手动删除缓存等不会触发 store 更新）。正确做法：store 仅持久化"身份标识"（`contentHash`），不持久化"状态断言"（`isIndexed`）；每次挂载时通过 IPC 向主进程确认物理缓存是否真实存在，再更新运行时状态。

**RRF（Reciprocal Rank Fusion）混合搜索**

RRF 是一种无参数的排名融合算法，公式为 `score = Σ 1/(k + rank_i)`，其中 `k=60` 是平滑系数，`rank_i` 是文档在第 i 路检索结果中的名次。RRF 的优势在于：无需归一化不同检索路（BM25 分数 vs 余弦相似度）的分数量纲，对高排名文档给予显著奖励，对低排名文档自然衰减。在语义搜索（覆盖度高但仅采样了部分 chunk）+ 词法搜索（全量 chunk 覆盖但语义理解弱）的场景下，RRF 能有效弥合两者的互补缺陷。

---

### 面试问答

**Q: 为什么 Electron 的 Web Worker 中不能用 `file://` 加载本地资源？如何正确架构需要访问本地文件的 ML 推理任务？**

> Electron 的渲染进程运行在 Chromium 内核中，继承了浏览器的安全沙箱限制：Web Worker 被视为"网页子线程"，同样受跨源资源加载政策约束，`file://` 协议被视为不安全的本地资源访问而被拦截。正确的架构是将 ML 推理移至主进程（Node.js 环境）：主进程通过 `ipcMain.handle` 暴露 `rag:ingest` 和 `rag:search` 接口；渲染进程通过 `ipcRenderer.invoke` 调用；结果异步返回。主进程可以自由使用 `fs`、`onnxruntime-node`、`@huggingface/transformers` 等 Node.js 原生能力，不受 Chromium 沙箱限制。

**Q: 如何处理"persist 缓存元数据"与"磁盘物理文件"之间的状态不一致问题？**

> 核心原则是**不要持久化可以动态验证的状态断言**。`isIndexed: true` 这类状态本质上是对某个外部事实（物理文件存在）的断言，而这个外部事实可以随时被其他操作改变（版本升级、手动清理、磁盘错误）。正确做法：store 仅持久化稳定的唯一标识（`contentHash`），每次应用启动或书籍打开时，通过 IPC 向主进程实际检查缓存文件是否存在，用检查结果动态设置运行时状态（`isIndexed`）。这样即使 store 数据陈旧，每次都会重新验证，保证一致性。

**Q: 在大文档 RAG 场景下，如何平衡"检索覆盖率"和"向量化计算成本"？**

> 核心思路是**分层覆盖**：全量 chunk 做词法索引（BM25/TF-IDF），保证覆盖率；语义向量化只覆盖采样子集（头/中/尾各取若干 chunk），控制成本。采样策略优先保证文本的结构代表性：头部 chunk 通常包含人物介绍/设定，尾部 chunk 包含高潮/结局，均匀分布的中间 chunk 覆盖情节发展，这三段的语义密度通常高于随机采样。检索时用 RRF 融合语义（高精度但局部覆盖）和词法（低精度但全量覆盖）的结果，互补缺陷。对于极超大文档（> 10M 字），还可以进一步增大 `chunkSize` 来减少 chunk 总数，用更粗粒度的语义单元降低向量化成本。

---
