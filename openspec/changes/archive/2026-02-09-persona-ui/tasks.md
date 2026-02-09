## 1. UI 基础组件

- [x] 1.1 添加 shadcn/ui Textarea 组件到 `src/shared/components/ui/textarea.tsx`
- [x] 1.2 添加 shadcn/ui Label 组件到 `src/shared/components/ui/label.tsx`

## 2. PersonaGenerator Stub

- [x] 2.1 创建 `src/features/chat/services/persona-generator.ts`，导出 `generatePersonaStub(bookId: string, name: string)` 异步函数
- [x] 2.2 函数返回占位数据（personality、speechStyle、background、keyQuotes、description），模拟 500ms 延迟

## 3. usePersona Hook

- [x] 3.1 创建 `src/features/persona/hooks/usePersona.ts`，定义 form 状态类型（name, description, personality, speechStyle, background, keyQuotesText）
- [x] 3.2 实现 `setField(field, value)` 更新单个字段，name 字段更新时清除 nameError
- [x] 3.3 实现 `generatePersona()` — 验证 name 非空，调用 stub，填充结果到 form
- [x] 3.4 实现 `savePersona()` — 验证 name 非空，构建 Persona 对象（UUID、timestamps、keyQuotes 分割），调用 store.setPersona + setActivePersona，返回 boolean
- [x] 3.5 实现 `loadPersona(persona)` — 将 Persona 数据填充到 form，keyQuotes 以 `\n` 连接
- [x] 3.6 实现 `resetForm()` — 重置所有字段为初始空值

## 4. PersonaConfigDialog 组件

- [x] 4.1 创建 `src/features/persona/components/PersonaConfigDialog.tsx`，使用 Dialog + DialogContent 受控模式（open, onOpenChange props）
- [x] 4.2 实现角色名称 Input 区域（Label + Input + 错误样式 ring-red-500）
- [x] 4.3 实现角色描述 Textarea 区域（Label + Textarea，可选字段）
- [x] 4.4 实现 "✨ 一键生成人设" 按钮（加载状态 Loader2 旋转 + disabled + 文案切换）
- [x] 4.5 实现分隔线 + 生成结果区域：四个 Textarea（性格特征、说话风格、背景故事、代表性台词）
- [x] 4.6 实现底部操作栏："保存角色" + "取消" 按钮
- [x] 4.7 保存时调用 hook.savePersona()，成功则关闭弹窗
- [x] 4.8 支持 existingPersona prop：传入时调用 hook.loadPersona 预填充表单

## 5. 集成

- [x] 5.1 在 ReaderHeader 的 Persona 按钮 onClick 中触发 PersonaConfigDialog 打开
- [x] 5.2 在 ReaderPage 中渲染 PersonaConfigDialog 组件，传入 bookId 和 open 状态

## 6. 验证

- [x] 6.1 运行 `npx tsc --noEmit` 确认零 TypeScript 错误
- [x] 6.2 确认所有新文件符合 Persona 接口和宪法 UI 规范
