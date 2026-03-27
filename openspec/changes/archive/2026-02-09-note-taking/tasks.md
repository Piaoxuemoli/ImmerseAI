## 1. 类型定义与工具函数

- [x] 1.1 在 `src/shared/types/index.ts` 中扩展 `Message` 类型，新增可选 `metadata?: { type: 'note-confirmation' | 'note-error', filePath?: string, noteTitle?: string, error?: string }` 字段
- [x] 1.2 创建 `src/features/chat/utils/note-intent.ts`，实现 `detectNoteIntent(message: string)` 函数，返回 `{ isNote: boolean, isAppend: boolean, topic?: string }`
- [x] 1.3 创建 `src/features/chat/utils/note-filename.ts`，实现文件名安全处理函数 `buildNoteFilename(bookTitle: string, topic: string, date: Date): string`

## 2. 笔记内容生成

- [x] 2.1 创建 `src/features/chat/utils/note-prompt.ts`，定义笔记专用 system prompt 模板（包含 Markdown 结构要求：标题、要点、原文摘录、感想）
- [x] 2.2 创建 `src/features/chat/services/note-generator.ts`，实现 `generateNoteContent(messages: Message[], bookTitle: string, topic?: string): Promise<string>` 函数，调用 `window.electronAPI.llm.chat()` 生成笔记

## 3. 笔记文件写入

- [x] 3.1 创建 `src/features/chat/services/note-writer.ts`，实现 `writeNote(bookshelfPath: string, bookTitle: string, topic: string, content: string, append: boolean): Promise<{ success: boolean, filePath: string, error?: string }>` 函数
- [x] 3.2 在 `writeNote` 中实现追加模式：先 `readFile` 获取现有内容，拼接后 `writeFile` 覆写
- [x] 3.3 在 `writeNote` 中实现目录创建容错：writeFile 失败时尝试创建 notes/ 目录后重试

## 4. Store 扩展

- [x] 4.1 在 Zustand Store 中新增 `lastNotePath: string | null` 状态和 `setLastNotePath(path: string | null)` action
- [x] 4.2 确保 `lastNotePath` 在 `selectedBookId` 切换时清空为 null

## 5. useChat Hook 扩展

- [x] 5.1 在 `useChat.sendMessage` 入口处集成 `detectNoteIntent`，根据结果分支进入笔记流程或常规对话流程
- [x] 5.2 实现笔记流程编排：意图检测 → 生成笔记 → 写入文件 → 插入确认消息 → 更新 lastNotePath
- [x] 5.3 实现笔记流程错误处理：任何步骤失败时插入 `note-error` 类型消息并恢复 `isGenerating` 状态
- [x] 5.4 在 hook 返回值中暴露 `lastNotePath`

## 6. UI 组件

- [x] 6.1 创建 `src/features/chat/components/NoteConfirmation.tsx`，实现笔记确认卡片组件（绿色成功/红色失败，含标题、路径、framer-motion 动画）
- [x] 6.2 修改 `MessageBubble.tsx`，根据 `metadata.type` 分支渲染：`note-confirmation` → NoteConfirmation 组件，`note-error` → 错误卡片

## 7. 验证与收尾

- [x] 7.1 确保 TypeScript 编译通过（`tsc --noEmit` 零错误）— 新增代码零错误，剩余 3 个为预存错误
- [x] 7.2 验证笔记意图检测覆盖所有关键词且不误触发
- [x] 7.3 验证 MCP 未连接时的错误提示正确展示
