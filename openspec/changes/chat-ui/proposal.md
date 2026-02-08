## Why

Phase 4 的 llm-handler 已实现流式 LLM 通信管道（主进程 → IPC → ReadableStream），但渲染进程尚无任何对话 UI。用户无法与 AI 角色进行沉浸式对话。chat-ui 是连接 LLM 后端能力与用户交互的关键前端模块，也是宪法第六章 6.3 节定义的阅读页 Chat Mode 的核心实现。

## What Changes

- 新增 `ChatInterface` 容器组件，管理消息列表渲染和滚动行为
- 新增 `MessageBubble` 组件，区分用户/AI 消息样式（用户右对齐 slate-100，AI 左对齐白色带边框）
- 新增 `ChatInput` 固定底部输入框，集成角色名 placeholder 和发送逻辑
- 新增 `CitationBadge` 引用标签组件（📎图标 + 章节信息，可点击）
- 新增 `useChat` hook，封装 LLM 流式调用、消息状态管理和打字机效果
- 使用 framer-motion 实现消息出现动画
- 集成 Zustand Store 的 `currentSession`、`isGenerating`、`addMessage` 等已有状态/动作

## Capabilities

### New Capabilities
- `chat-interface`: 对话界面的组件体系（ChatInterface、MessageBubble、ChatInput、CitationBadge）及其布局、样式、交互规范
- `chat-streaming`: useChat hook 的流式调用逻辑，包括 ReadableStream 消费、打字机效果、消息组装和错误处理

### Modified Capabilities
（无。现有 global-store 和 preload-bridge 已提供所需的状态字段和 IPC 接口，无需修改 spec 级别的需求。）

## Impact

- **新增文件**：
  - `src/features/chat/components/ChatInterface.tsx`
  - `src/features/chat/components/MessageBubble.tsx`
  - `src/features/chat/components/ChatInput.tsx`
  - `src/features/chat/components/CitationBadge.tsx`
  - `src/features/chat/hooks/useChat.ts`
- **依赖**：framer-motion（已在 package.json），shadcn/ui 的 ScrollArea、Avatar、Button
- **集成点**：
  - `window.electronAPI.llm.chat()` — ReadableStream 流式响应
  - Zustand `useStore` — currentSession / isGenerating / addMessage / activePersonaId
  - 未来由 ReaderPage 的 Chat Mode 挂载此组件
