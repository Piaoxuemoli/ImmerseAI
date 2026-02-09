# ImmerseAI 测试分类与执行方案

> 生成日期：2026-02-09
> 项目总体完成度：约 65-70%

---

## 项目进度快照

| Phase | 模块 | 完成度 | 关键缺口 |
|-------|------|--------|----------|
| Phase 1 基建 | IPC / Store / 路由 / 类型 | **100%** | 无 |
| Phase 2 书架 | McpManager / BookshelfUI | **~40%** | IPC handlers 全是 mock 数据，未接入真实 McpManager；BookCard 点击无路由跳转；挂载流程无 UI 入口 |
| Phase 3 大脑 | RAG Worker (ingest+search) | **100%** | 无 |
| Phase 4 灵魂 | LLM / Chat / Persona / Reader | **~90%** | 无设置页导致 API Key 无法通过 UI 配置 |
| Phase 5 整合 | 引用跳转/笔记/Librarian/设置/打包 | **~10%** | 几乎全部缺失 |

---

## 第一类：Agent 可自动化测试

> **执行方式**：将以下 Prompt 逐条发送给 Copilot Agent，Agent 自行执行命令/读取代码/运行脚本，产出明确的 PASS/FAIL 结论并在 FAIL 时自动修复。

---

### AT-01: TypeScript 编译检查

```
请对 ImmerseAI 项目执行完整的 TypeScript 编译检查。

执行步骤：
1. 在项目根目录运行 `npx tsc --noEmit`（渲染进程代码）
2. 在项目根目录运行 `npx electron-vite build`（完整构建检查）

预期结果：
- 零编译错误 (0 errors)
- 允许存在 warnings 但应记录

结果处理：
- PASS: 报告 "TypeScript 编译通过，0 错误"
- FAIL: 列出所有错误，按文件分组，逐个修复类型错误。修复后重新运行编译验证直到通过。
  常见问题处理模式：
  - `any` 类型 → 替换为正确的具体类型
  - 缺少类型声明文件 → 创建 .d.ts 文件
  - import 路径错误 → 修正 path alias 配置
  - 接口不匹配 → 对齐接口定义与实际使用
```

---

### AT-02: 依赖完整性检查

```
请验证 ImmerseAI 项目的依赖完整性。

执行步骤：
1. 检查 node_modules 是否存在，如不存在先运行 `npm install`
2. 运行 `npm ls --depth=0` 检查顶层依赖
3. 对比 package.json 中声明的依赖与实际代码中的 import 语句：
   - grep 搜索所有 .ts/.tsx 文件中的 import 语句
   - 提取第三方包名（非相对路径 import）
   - 与 package.json dependencies 对比

预期结果：
- `npm ls` 无 MISSING 或 INVALID 标记
- 代码中 import 的每个第三方包都在 package.json 中声明
- package.json 中没有未被任何代码引用的"幽灵依赖"

结果处理：
- PASS: 报告依赖一致
- FAIL: 
  - 缺失依赖 → 运行 `npm install <package>` 安装
  - 幽灵依赖 → 记录但不自动删除（可能是间接使用）
  - 版本冲突 → 记录冲突详情
```

---

### AT-03: Zustand Store 结构一致性

```
请验证 Zustand Store 实现是否与宪法第五章 5.2 节的 ImmerseStore 接口一致。

执行步骤：
1. 读取 src/shared/types/index.ts 中的 ImmerseStore 接口定义
2. 读取 src/shared/store/index.ts 中的实际 Store 实现
3. 逐字段对比：
   - 所有 state 字段是否都有初始值
   - 所有 action 是否都有实现
   - persist middleware 是否配置正确（books/personas/currentSession 持久化；indexingProgress/isGenerating 不持久化）

预期结果：
- ImmerseStore 接口的每个字段在 store 中都有对应实现
- persist middleware 的 partialize 函数排除了 indexingProgress 和 isGenerating
- 所有 action 参数类型与接口定义一致

结果处理：
- PASS: 报告 Store 结构一致
- FAIL: 
  - 缺失字段 → 在 store 中补充实现
  - 持久化配置错误 → 修正 partialize 函数
  - 类型不匹配 → 对齐类型定义
```

---

### AT-04: IPC Channel 一致性检查

```
请验证 preload 暴露的 IPC channel 与 main process handlers 是否完全匹配。

执行步骤：
1. 读取 electron/preload/index.ts，提取所有 ipcRenderer.invoke('channel-name') 的 channel 列表
2. 读取 electron/main/ipc-handlers.ts，提取所有 ipcMain.handle('channel-name') 的 channel 列表
3. 读取 electron/main/index.ts，确认 registerIpcHandlers() 被调用
4. 对比两个列表，找出不匹配项
5. 检查每对 handler 的参数签名是否一致

预期结果：
- preload 的每个 invoke channel 在 main 中都有对应 handle
- main 的每个 handle channel 在 preload 中都有调用
- 参数类型签名一致
- registerIpcHandlers() 在 app.whenReady() 后被调用

结果处理：
- PASS: 报告 IPC 通道完全匹配
- FAIL: 
  - preload 有但 main 无 → 在 ipc-handlers.ts 中补充 handler
  - main 有但 preload 无 → 在 preload 中补充暴露
  - 参数不一致 → 对齐双方签名
```

---

### AT-05: 路由配置完整性

```
请验证 React Router 配置是否覆盖所有页面组件。

执行步骤：
1. 读取 src/app/router.tsx 的路由定义
2. 检查每个路由对应的页面组件文件是否存在且非空
3. 检查导入路径是否正确
4. 验证以下路由存在：
   - / → 重定向到 /bookshelf
   - /bookshelf → BookshelfPage
   - /reader/:id → ReaderPage
5. 检查是否存在 404 兜底路由

预期结果：
- 三条核心路由全部配置且组件存在
- 重定向正确
- 组件文件可正常导入

结果处理：
- PASS: 报告路由配置完整
- FAIL:
  - 缺失路由 → 在 router.tsx 中添加
  - 组件不存在 → 创建最小可用的页面骨架
  - 缺少 404 → 添加 * 通配路由
```

---

### AT-06: IPC Handlers 真实桥接检查（关键缺陷）

```
请检查 electron/main/ipc-handlers.ts 中的 MCP handlers 是否接入了真实的 McpManager。

执行步骤：
1. 读取 ipc-handlers.ts，检查 mcp:list-files / mcp:read-file / mcp:write-file / mcp:move-file 的实现
2. 确认是否导入了 McpManager
3. 确认是否调用了 McpManager 的方法

预期结果：
- mcp:* handlers 应调用 McpManager.getInstance() 的真实方法
- 不应返回硬编码 mock 数据

结果处理：
- FAIL（已知）: 当前全是 mock 数据。执行以下修复：
  1. 在 ipc-handlers.ts 中 import { McpManager } from './mcp-manager'
  2. 将 mcp:list-files handler 改为调用 McpManager.getInstance().listFiles(path)
  3. 将 mcp:read-file handler 改为调用 McpManager.getInstance().readFile(path)
  4. 将 mcp:write-file handler 改为调用 McpManager.getInstance().writeFile(path, content)
  5. 将 mcp:move-file handler 改为调用 McpManager.getInstance().moveFile(source, destination)
  6. 添加 mcp:connect 和 mcp:disconnect handler
  7. McpManager 连接失败时返回有意义的错误（不是空数组）
  8. 修复后重新运行 AT-01 确认编译通过
```

---

### AT-07: BookCard 路由跳转检查（关键缺陷）

```
请检查 BookCard 组件是否实现了点击跳转到 /reader/:id 的逻辑。

执行步骤：
1. 读取 src/features/bookshelf/components/BookCard.tsx
2. 检查 onClick handler 是否调用 react-router-dom 的 useNavigate
3. 检查 BookGrid.tsx 和 BookshelfPage.tsx 是否正确传递点击事件

预期结果：
- BookCard 点击后应 navigate(`/reader/${book.id}`)
- 同时应调用 store 的 selectBook(book.id)

结果处理：
- FAIL（已知）: onClick 为空。执行以下修复：
  1. 在 BookCard 中 import { useNavigate } from 'react-router-dom'
  2. 实现 onClick: navigate(`/reader/${book.id}`) + selectBook(book.id)
  3. 确保 BookshelfPage 使用真实的 store.books 而非 MOCK_BOOKS
  4. 验证修复后 TypeScript 编译通过
```

---

### AT-08: 挂载书架流程检查（关键缺陷）

```
请检查书架挂载流程是否有完整的 UI 入口和业务逻辑。

执行步骤：
1. 检查 TopBar.tsx 中的按钮是否有 onClick 处理
2. 检查 BookshelfPage.tsx 是否使用真实数据（而非 MOCK_BOOKS）
3. 检查是否存在调用 window.electronAPI.app.selectDirectory() 的代码
4. 检查调用 mcp:list-files 后的数据是否写入 Zustand store

预期结果：
- TopBar 有"导入/挂载"按钮可点击
- 点击后弹出目录选择对话框
- 选择后发起 MCP 连接 + listFiles
- 文件列表转换为 Book[] 写入 store
- BookGrid 响应式渲染

结果处理：
- FAIL（已知）: 流程未串联。执行以下修复：
  1. 创建 src/features/bookshelf/hooks/useBookshelf.ts
     - mountBookshelf(): selectDirectory → MCP connect → listFiles → setBooks
     - importBook(): 单本导入
  2. TopBar 的 Import 按钮绑定 mountBookshelf()
  3. BookshelfPage 从 store.books 读取而非 MOCK
  4. 处理空书架和加载中两种状态
  5. 验证 TypeScript 编译通过
```

---

### AT-09: Worker 消息协议完整性

```
请验证 RAG Worker 的消息协议是否符合宪法第四章 4.2.4 节定义。

执行步骤：
1. 读取 src/workers/rag-types.ts 的类型定义
2. 读取 src/workers/rag.worker.ts 的 onmessage handler
3. 逐条对比：
   - WorkerMessage 类型是否包含: ingest / search / status
   - WorkerResponse 类型是否包含: ingest:progress / ingest:complete / search:result / status:result / error
   - 每种消息的字段是否与宪法定义一致
4. 读取 src/shared/hooks/useRagWorker.ts 检查 hook 是否正确封装所有消息类型

预期结果：
- 所有规定的消息类型都已定义和处理
- hook 暴露对应的便捷方法（ingest/search/getStatus）

结果处理：
- PASS: 报告消息协议完整
- FAIL: 补充缺失的消息类型/处理器
```

---

### AT-10: Persona System Prompt 模板检查

```
请验证角色 System Prompt 是否使用宪法第四章 4.3.4 节定义的模板结构。

执行步骤：
1. 读取 src/features/chat/services/persona-generator.ts
2. 找到 systemPrompt 生成逻辑
3. 对比宪法模板的必备结构：
   - 包含 {role_name}
   - 包含 【身份背景】{persona_background}
   - 包含 【性格特征】{persona_personality}
   - 包含 【说话风格】{persona_speech_style}
   - 包含 【当前上下文】{rag_context} 占位
   - 包含 5 条【行为准则】

预期结果：
- 模板结构完整，所有占位符都能被真实数据替换
- 行为准则第4条包含"绝对不要暴露你是AI"

结果处理：
- PASS: 报告模板符合宪法
- FAIL: 修正模板使其完全匹配宪法定义
```

---

### AT-11: 安全配置检查

```
请验证 Electron 安全配置是否符合宪法第十章。

执行步骤：
1. 读取 electron/main/index.ts 中的 BrowserWindow 配置
2. 检查以下安全项：
   - nodeIntegration: false
   - contextIsolation: true
   - sandbox 配置
3. 确认 API Key 永远不传递到渲染进程：
   - grep 搜索所有渲染进程代码（src/）中是否有 apiKey 字符串
   - 检查 llm-handler.ts 中 API Key 来源是否为 safeStorage
4. 检查 preload 不暴露直接的 Node.js API（无 require/process 传递）

预期结果：
- nodeIntegration=false, contextIsolation=true
- 渲染进程代码中无 API Key 直接引用
- LLM handler 从 safeStorage 读取 Key

结果处理：
- PASS: 报告安全配置合规
- FAIL:
  - nodeIntegration 未关闭 → 立即修正为 false
  - API Key 泄漏到渲染进程 → 移除并改为 IPC 间接调用
```

---

### AT-12: 设置页面存在性检查（关键缺陷）

```
请检查设置页面是否存在，如不存在则创建。

执行步骤：
1. 检查 src/features/settings/ 目录是否存在
2. 检查 router.tsx 中是否有 /settings 路由
3. 检查 TopBar 的设置按钮是否有 onClick 跳转

预期结果：
- SettingsPage.tsx 存在且功能完整
- /settings 路由已注册
- TopBar 设置图标可跳转

结果处理：
- FAIL（已知）: 设置页面缺失。执行以下创建：
  1. 创建 src/features/settings/SettingsPage.tsx
     - LLM Provider 下拉选择 (deepseek/kimi/moonshot/openai/custom)
     - API Key 输入框 (通过 IPC 调用 safeStorage 加密存储)
     - Base URL 输入框
     - Model 名称输入框
     - Temperature 滑块 (0.0-1.0)
     - MaxTokens 滑块 (256-8192)
     - 书架路径显示 + 更换目录按钮
     - "测试连接"按钮
  2. 在 router.tsx 中注册 /settings 路由
  3. TopBar 设置按钮绑定 navigate('/settings')
  4. 使用 shadcn/ui: Input, Label, Separator + 自建 Select/Slider
  5. 配置变更即时写入 Zustand Store
  6. 验证 TypeScript 编译通过
```

---

### AT-13: shadcn/ui 组件完整性

```
请检查项目中使用的 shadcn/ui 组件是否都已安装。

执行步骤：
1. 列出 src/shared/components/ui/ 目录下已有的组件文件
2. grep 搜索 src/ 目录中所有 from '@/shared/components/ui/xxx' 的导入
3. 对比：是否有被导入但文件不存在的组件

预期结果：
- 所有被导入的 UI 组件文件都存在
- 根据宪法需求，至少应有：button, dialog, input, label, scroll-area, textarea, avatar
- Phase 5 还需要：toast, separator, select, slider

结果处理：
- PASS: 报告组件完整
- FAIL: 列出缺失组件，使用 shadcn CLI 或手动创建缺失的组件文件
```

---

### AT-14: electron.d.ts 类型声明检查

```
请检查 src/shared/types/electron.d.ts 是否存在且正确。

执行步骤：
1. 检查 electron/preload/index.ts 中 import 的 ElectronAPI 类型来源
2. 检查 src/shared/types/electron.d.ts 是否存在
3. 如存在，验证 ElectronAPI 接口是否与 preload 暴露的 API 结构一致
4. 检查渲染进程中访问 window.electronAPI 时的类型是否正确

预期结果：
- electron.d.ts 存在且导出 ElectronAPI 接口
- window.electronAPI 全局类型声明正确
- 与 preload 暴露的 API 完全一致

结果处理：
- FAIL: 创建/修正 electron.d.ts：
  1. 定义 ElectronAPI 接口（mcp/llm/app 三部分）
  2. 扩展 Window 接口声明 electronAPI 属性
  3. 确保 tsconfig.json include 包含此文件
```

---

## 第二类：人工体验测试

> **执行方式**：人类测试员手动操作应用，逐项体验并在"实际结果"列填写，状态标记 ✅/❌/⚠️。
> 完成后将此表格交给 Agent，Agent 根据 ❌ 项自动修复。

---

### HT-01: 应用启动与外观

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 1.1 | 运行 `npm run dev` 启动应用 | Electron 窗口在 3 秒内打开，无白屏 | | |
| 1.2 | 窗口标题 | 显示 "ImmerseAI" 或自定义标题 | | |
| 1.3 | 整体视觉风格 | Notion 极简风，黑白灰主色调，无杂色 | | |
| 1.4 | 字体渲染 | Inter / system-ui 字体，清晰无锯齿 | | |
| 1.5 | 响应式布局 | 拖拽窗口缩小，书架网格列数自适应 | | |
| 1.6 | DevTools 控制台 | 无 Error 级别日志（Warning 可忽略） | | |

---

### HT-02: 书架页 UI 与交互

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 2.1 | TopBar 渲染 | 左侧 "ImmerseAI" Logo，右侧 Settings/Import/GitHub 图标 | | |
| 2.2 | BookGrid 渲染 | 书籍卡片网格展示，2:3 宽高比封面 | | |
| 2.3 | BookCard hover | 鼠标悬停卡片有缩放/阴影效果 | | |
| 2.4 | BookCard 信息 | 卡片显示：封面 + 书名 + 作者 | | |
| 2.5 | BookCard 点击 | 点击书籍卡片跳转到 `/reader/:id`（⚠️ 当前已知缺失） | | |
| 2.6 | LibrarianBar 位置 | 固定在页面底部，不随页面滚动 | | |
| 2.7 | LibrarianBar 输入 | 输入框有 placeholder，可输入文字 | | |
| 2.8 | 空书架状态 | 无书籍时显示引导（如 "拖入 EPUB 文件"）| | |
| 2.9 | 滚动行为 | 书籍多时可滚动，LibrarianBar 不随滚动移动 | | |

---

### HT-03: 目录挂载流程（⚠️ 需 AT-06/AT-08 修复后测试）

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 3.1 | 挂载入口 | TopBar Import 按钮可点击 | | |
| 3.2 | 目录选择 | 弹出系统原生文件夹选择对话框 | | |
| 3.3 | 取消选择 | 取消对话框后无异常，状态不变 | | |
| 3.4 | MCP 连接 | 选择目录后，connectionStatus 变为 'connected' | | |
| 3.5 | EPUB 扫描 | 自动列出目录中的 .epub 文件 | | |
| 3.6 | 书籍展示 | 扫描到的书籍出现在 BookGrid 中 | | |
| 3.7 | 非 EPUB 过滤 | 非 .epub 文件不显示在书架中 | | |

---

### HT-04: EPUB 阅读器

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 4.1 | 加载 EPUB | 从书架点击后正确加载并渲染 EPUB 内容 | | |
| 4.2 | 翻页功能 | 左右翻页/点击翻页正常 | | |
| 4.3 | ReaderHeader | 显示：返回按钮 + 书名 + 角色选择 + 模式切换 | | |
| 4.4 | 返回导航 | 点击返回按钮回到书架页 | | |
| 4.5 | 阅读进度记忆 | 关闭后重新打开，恢复到上次阅读位置 | | |
| 4.6 | 文本选择 | 能选中文本（为未来功能预留） | | |

---

### HT-05: 模式切换（阅读 ⇄ 对话）

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 5.1 | 切换按钮 | ModeToggle 按钮可见，显示📖/💬 图标 | | |
| 5.2 | 切换动画 | framer-motion 过渡平滑，无闪烁无白屏 | | |
| 5.3 | 阅读→对话 | 点击后显示 ChatInterface | | |
| 5.4 | 对话→阅读 | 点击后恢复 EpubViewer，位置不丢失 | | |
| 5.5 | 聊天保持 | 切换模式后返回对话，历史消息保留 | | |

---

### HT-06: 角色配置

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 6.1 | 弹窗打开 | 点击角色选择按钮弹出 PersonaConfigDialog | | |
| 6.2 | 表单字段 | 角色名称（必填）+ 描述（选填）输入框 | | |
| 6.3 | 一键生成 | 点击 "✨ 一键生成人设" 触发 RAG + LLM（需 API Key） | | |
| 6.4 | 生成结果 | 展示：性格特征、说话风格、代表台词、背景故事 | | |
| 6.5 | 手动编辑 | 所有生成的字段可手动修改 | | |
| 6.6 | 保存角色 | 保存后 Store 更新，角色可在对话中使用 | | |
| 6.7 | 取消操作 | 取消关闭弹窗，不保存任何数据 | | |

---

### HT-07: AI 对话体验（需 API Key 配置后）

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 7.1 | 消息发送 | 输入文字按 Enter/点击发送，消息出现在聊天区 | | |
| 7.2 | 用户消息样式 | 右对齐，slate-100 背景 | | |
| 7.3 | AI 消息样式 | 左对齐，白色带边框，角色名首字头像 | | |
| 7.4 | 流式打字机 | AI 回复逐字/逐词出现，而非整块弹出 | | |
| 7.5 | 角色扮演 | AI 以设定角色身份回复，语气/内容符合人设 | | |
| 7.6 | 引用标签 | 回复中如有书籍引用，显示 CitationBadge | | |
| 7.7 | 自动滚动 | 新消息自动滚动到底部 | | |
| 7.8 | 停止生成 | 有途径中断正在生成的 AI 回复 | | |
| 7.9 | 空状态 | 无消息时显示引导/空状态 | | |

---

### HT-08: RAG 索引体验

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 8.1 | 首次索引触发 | 点击未索引的书 → 开始索引 | | |
| 8.2 | 进度展示 | 进度从 0% → 100% 可视化更新 | | |
| 8.3 | 索引期间 UI | UI 不卡顿，可正常操作其他内容 (P-2 验证) | | |
| 8.4 | 索引完成 | 完成后 Book.isIndexed=true | | |
| 8.5 | 重启后缓存 | 关闭重启应用，同一本书无需重新索引 | | |
| 8.6 | 大文件性能 | 500 页以上的 EPUB 能在合理时间内完成 | | |

---

### HT-09: 设置页面（⚠️ 需 AT-12 创建后测试）

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 9.1 | 页面导航 | TopBar 设置图标跳转到 /settings | | |
| 9.2 | Provider 选择 | 下拉可选 deepseek/kimi/moonshot/openai/custom | | |
| 9.3 | API Key 输入 | 输入后加密存储，不明文显示 | | |
| 9.4 | Base URL | 根据 Provider 自动填充默认值 | | |
| 9.5 | 测试连接 | 点击后显示连接成功/失败 | | |
| 9.6 | 配置持久化 | 重启应用后所有设置保留 | | |
| 9.7 | 返回导航 | 能返回书架页 | | |

---

### HT-10: 端到端完整流程

| # | 测试项 | 预期结果 | 实际结果 | 状态 |
|---|--------|----------|----------|------|
| 10.1 | 首次启动 | 应用正常启动，展示空书架 | | |
| 10.2 | 配置 API Key | 设置页配置 → 测试连接成功 | | |
| 10.3 | 挂载书架 | 选择含 EPUB 的目录 → 书籍出现 | | |
| 10.4 | 打开书籍 | 点击书籍 → 阅读器加载 | | |
| 10.5 | RAG 索引 | 自动索引 → 进度条 → 完成 | | |
| 10.6 | 创建角色 | 开弹窗 → 输入名字 → 一键生成 → 保存 | | |
| 10.7 | AI 对话 | 切换对话模式 → 发消息 → 流式回复 | | |
| 10.8 | 引用跳转 | 点击引用 → 跳转阅读器原文位置 | | |
| 10.9 | 整体流畅度 | 全程无卡顿、无崩溃、UI 帧率 60fps | | |
| 10.10 | 重启恢复 | 重启后：书架/进度/角色/设置全部恢复 | | |

---

## 执行建议

### 推荐执行顺序

1. **先执行 Agent 自动化测试** AT-01 → AT-14（约 30 分钟）
2. **AT-06/07/08/12 会产出修复代码**，修复后进入人工测试
3. **人工测试** HT-01 → HT-10（约 1-2 小时）
4. **人工出具报告后**，将带 ❌ 标记的表格发给 Agent 修复

### 人工测试报告模板

测试完成后，请将表格复制并在"实际结果"和"状态"列填写内容，然后发送以下 Prompt：

```
以下是人工测试报告，请修复所有标记为 ❌ 的项目：

[粘贴带有填写结果的表格]

修复要求：
1. 逐个 ❌ 项分析原因
2. 实施代码修复
3. 修复后运行 TypeScript 编译检查
4. 给出修复摘要
```
