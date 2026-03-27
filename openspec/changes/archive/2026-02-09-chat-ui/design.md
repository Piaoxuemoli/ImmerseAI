## Context

llm-handler 已在主进程实现了流式 LLM 调用（openai SDK → IPC chunk 事件 → preload ReadableStream）。Zustand Store 已定义完整的对话状态（`currentSession`、`isGenerating`、`addMessage`、`activePersonaId`）。shadcn/ui 的 ScrollArea、Button、Avatar 和 framer-motion 均已安装。

当前 `src/features/chat/components/` 和 `src/features/chat/hooks/` 目录为空。ReaderPage 为占位符，将在 epub-reader change 中集成 Chat Mode 挂载本模块。

## Goals / Non-Goals

**Goals:**
- 实现完整的对话组件体系（ChatInterface → MessageBubble / ChatInput / CitationBadge）
- 实现 `useChat` hook 消费 `ReadableStream<string>` 并产生逐字打字机效果
- 消息自动滚动、输入状态管理、生成中禁用发送
- 组件可独立工作，不依赖 ReaderPage 的 mode 切换（由上层挂载控制）

**Non-Goals:**
- 不实现 Read ⇄ Chat 模式切换动画（属于 epub-reader change）
- 不实现 PersonaConfigDialog（属于 persona-ui change）
- 不实现 CitationBadge 的点击跳转逻辑（属于 citation-jump change）
- 不实现 RAG 检索调用（chat-streaming 仅对接 LLM，RAG 上下文注入由未来 persona-generator 负责）
- 不修改 Zustand Store 或 preload bridge 的接口定义

## Decisions

### D1: 组件拆分策略

**选择**: 4 个展示组件 + 1 个容器组件 + 1 个 hook

```
ChatInterface (容器)
├── MessageBubble (展示 — 单条消息)
│   └── CitationBadge (展示 — 引用标签)
├── ChatInput (展示 — 输入区)
└── useChat (hook — 流式逻辑)
```

**理由**: 容器/展示分离让 MessageBubble 和 CitationBadge 可被其他模块复用（如 LibrarianBar 对话）。useChat 作为独立 hook 使得流式逻辑可在不同 UI 上下文中复用。

**备选方案**: 将所有逻辑放入 ChatInterface 单文件 — 放弃，违反单一职责原则，难以测试和复用。

### D2: 流式消费与打字机效果

**选择**: useChat hook 内部使用 `ReadableStream.getReader()` 逐 chunk 读取，每个 chunk 立即 append 到 `streamingContent` state 变量。ChatInterface 通过监听该变量渲染实时打字效果。

```
flow:
  sendMessage() → setIsGenerating(true)
                → electronAPI.llm.chat(messages, config)
                → reader.read() loop
                → setStreamingContent(prev + chunk)  ← 触发重渲染 = 打字机效果
                → stream done → addMessage(完整消息) → setIsGenerating(false)
```

**理由**: ReadableStream API 是 preload 已暴露的标准接口，无需额外抽象。逐 chunk setState 利用 React 自身的重渲染机制产生自然打字效果，无需 `requestAnimationFrame` 或手动定时器。

**备选方案**: 使用 `setInterval` 逐字渲染缓冲区 — 放弃，增加复杂度且无法与流速度自适应匹配。

### D3: 消息列表滚动策略

**选择**: 使用 `useRef` 引用底部锚点元素，在流式内容变更和新消息时调用 `scrollIntoView({ behavior: 'smooth' })`。

**理由**: 原生 scrollIntoView 性能好、实现简单。仅在用户未手动上滚时自动滚动（通过 `isNearBottom` 检测），避免阅读历史消息时被强制跳转。

**备选方案**: shadcn ScrollArea 的 `scrollTo` API — 放弃，内部 API 不够稳定，且锚点方案更符合 React 模式。

### D4: framer-motion 动画策略

**选择**: 每条 MessageBubble 使用 `motion.div` 包裹，入场动画 `initial={{ opacity: 0, y: 10 }}` → `animate={{ opacity: 1, y: 0 }}`。transition duration 80ms，轻快不阻塞。

**理由**: 轻量动画提升感知质量而不影响滚动性能。仅入场动画，无退场动画（消息不会被删除）。

### D5: ChatSession 生命周期管理

**选择**: `useChat` hook 在 `sendMessage()` 时检查 `currentSession` 是否存在：
- 不存在 → 自动创建新 `ChatSession`（生成 UUID、关联 bookId + personaId，写入 Store）
- 存在 → 直接 append message

**理由**: 用户无需手动"创建会话"，首次发消息时自动初始化，降低交互成本。

### D6: AI 头像渲染

**选择**: assistant 消息左侧显示角色名首字（中文/英文均取首字符），渲染为 `slate-800` 背景的圆形 Avatar。通过 `activePersonaId` 从 Store 查找 Persona 获取角色名。

**无 Persona 时**: 显示默认 "AI" 文本。

### D7: CitationBadge — 仅渲染，不跳转

**选择**: 本次仅实现 CitationBadge 的视觉渲染（📎图标 + 章节名 + 相似度百分比），`onClick` 预留 prop 但不实现跳转逻辑。跳转功能在 citation-jump change 中实现。

**理由**: 解耦 UI 渲染和导航逻辑，避免在 EpubReader 尚未实现时引入无法工作的跳转代码。

## Risks / Trade-offs

- **[流式中断]** 用户快速切换页面时 ReadableStream 可能未正确关闭 → `useChat` 在 cleanup 函数中调用 `reader.cancel()` 并 `setIsGenerating(false)`
- **[长消息性能]** 大量消息（100+）导致列表渲染变慢 → 当前阶段可接受，未来可引入虚拟滚动（`react-virtuoso`）
- **[Markdown 渲染]** AI 消息 content 包含 Markdown 但本次不实现 Markdown 渲染器 → 先以纯文本 + `whitespace-pre-wrap` 展示，未来 change 中集成 `react-markdown`
- **[并发发送]** 用户连续快速点发送 → `isGenerating` 为 true 时禁用发送按钮，从 UI 层面阻止
