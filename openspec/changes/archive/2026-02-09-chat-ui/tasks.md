## 1. 基础组件 — CitationBadge

- [x] 1.1 创建 `src/features/chat/components/CitationBadge.tsx`：接收 `Citation` 和可选 `onClick` prop，渲染 📎 图标（Paperclip）+ 章节名 + 分数百分比，使用 inline-flex / bg-slate-50 / border-slate-200 / rounded-md / text-xs 样式，有 onClick 时 cursor-pointer 否则 cursor-default

## 2. 基础组件 — MessageBubble

- [x] 2.1 创建 `src/features/chat/components/MessageBubble.tsx`：接收 `Message` 和可选 `personaName` prop
- [x] 2.2 实现用户消息样式：flex justify-end，bg-slate-100 rounded-lg，不显示头像
- [x] 2.3 实现 AI 消息样式：flex justify-start，bg-white border border-slate-200 rounded-lg，左侧 Avatar
- [x] 2.4 实现 AI Avatar：使用 shadcn/ui Avatar，显示 personaName 首字符（bg-slate-800 文字白色），无 Persona 时显示 "AI"
- [x] 2.5 实现消息内容渲染：whitespace-pre-wrap，text-slate-900
- [x] 2.6 渲染 citations：消息文本下方为每个 Citation 渲染 CitationBadge
- [x] 2.7 添加 framer-motion 入场动画：motion.div，initial={{ opacity: 0, y: 10 }}，animate={{ opacity: 1, y: 0 }}，transition duration 80ms

## 3. 核心 Hook — useChat

- [x] 3.1 创建 `src/features/chat/hooks/useChat.ts`：定义返回类型（messages, streamingContent, isGenerating, sendMessage, stopGenerating）
- [x] 3.2 实现 Store 状态读取：从 Zustand 读取 currentSession / isGenerating / activePersonaId / selectedBookId / personas
- [x] 3.3 实现 sendMessage — 自动创建 ChatSession：当 currentSession 为 null 时生成 UUID 创建新 session 并 setCurrentSession
- [x] 3.4 实现 sendMessage — 追加用户消息：创建 Message（role: 'user'，UUID，时间戳）并 addMessage
- [x] 3.5 实现 sendMessage — 构建 LLM messages 数组：包含完整历史，如果有活跃 Persona 则在开头插入 system 消息
- [x] 3.6 实现 sendMessage — 调用 electronAPI.llm.chat 并 getReader 循环读取 chunk，逐 chunk append 到 streamingContent state
- [x] 3.7 实现流式完成处理：reader done 后创建 assistant Message（content = 完整 streamingContent），调用 addMessage，清空 streamingContent，setIsGenerating(false)
- [x] 3.8 实现 LLM API 调用失败错误处理：catch 后 setIsGenerating(false)，清空 streamingContent，追加 "[错误] " 前缀的 assistant 消息
- [x] 3.9 实现流式读取中断错误处理：catch 后 reader.cancel()，保存已有 streamingContent 为不完整消息，setIsGenerating(false)
- [x] 3.10 实现 stopGenerating：调用 reader.cancel()，保存已有 streamingContent（如非空），setIsGenerating(false)，清空 streamingContent
- [x] 3.11 实现 useEffect cleanup：组件卸载时如有活跃 reader 则 cancel 并 setIsGenerating(false)

## 4. 输入组件 — ChatInput

- [x] 4.1 创建 `src/features/chat/components/ChatInput.tsx`：接收 onSend 回调和 isGenerating / personaName props
- [x] 4.2 实现输入区布局：textarea + Send 按钮，固定底部，border-t border-slate-200
- [x] 4.3 实现角色名 Placeholder：有 personaName 时 "对 {personaName} 说点什么..."，否则 "输入消息..."
- [x] 4.4 实现 Enter 发送 / Shift+Enter 换行逻辑
- [x] 4.5 实现 isGenerating 时禁用发送按钮（disabled + 灰色视觉）

## 5. 容器组件 — ChatInterface

- [x] 5.1 创建 `src/features/chat/components/ChatInterface.tsx`：整合 useChat + MessageBubble + ChatInput
- [x] 5.2 渲染消息列表：遍历 messages 按 timestamp 升序排列，为每条渲染 MessageBubble
- [x] 5.3 渲染流式 AI 消息：isGenerating 时在列表底部额外渲染一个 streamingContent 的 MessageBubble
- [x] 5.4 实现空状态：currentSession 为 null 或消息为空时展示 "开始与角色对话..." 提示
- [x] 5.5 实现自动滚动：useRef 底部锚点，消息更新/streamingContent 变化时 scrollIntoView({ behavior: 'smooth' })
- [x] 5.6 实现 isNearBottom 检测：距底部 < 100px 时自动滚动，否则不干扰用户
- [x] 5.7 使用 shadcn/ui ScrollArea 包裹消息列表区域

## 6. 验证与集成

- [x] 6.1 TypeScript 编译验证：npx tsc --noEmit 无错误
- [x] 6.2 将 ChatInterface 临时挂载到 ReaderPage 的 chat mode 区域，验证基本渲染
- [ ] 6.3 手动测试：输入消息 → 调用 LLM → 流式打字机效果 → 消息保存到 Store
