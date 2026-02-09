## Context

Phase 4 需要 PersonaConfigDialog 组件，允许用户为书中角色配置人设。当前 `src/features/persona/components/` 为空目录。Store 已有完整的角色 Actions（`setPersona`、`setActivePersona`、`removePersona`），Persona 接口已定义。

宪法第六章 6.4 节定义了弹窗的视觉结构：角色名称输入、描述输入、一键生成按钮、生成结果展示区（性格特征/说话风格/代表台词/背景故事）、保存/取消按钮。

## Goals / Non-Goals

**Goals:**
- 创建完整的 PersonaConfigDialog 组件，严格遵循宪法 UI 设计
- 创建 usePersona hook 封装表单逻辑
- 所有生成的字段可手动编辑
- 保存时验证必填字段，写入 Zustand Store
- 添加缺失的 shadcn/ui Textarea 和 Label 组件

**Non-Goals:**
- 不实现 PersonaGenerator 的实际 RAG+LLM 生成逻辑（留给后续 change，本次用 stub）
- 不实现角色列表管理/切换 UI
- 不实现 avatar 上传

## Decisions

### D1: 弹窗控制方式 — 受控模式 (Controlled Dialog)
Dialog 的 open 状态由父组件通过 props 控制（`open` + `onOpenChange`），而非内部状态。

**理由**：ReaderHeader 中的 Persona 按钮需要触发弹窗，控制权应在使用侧。

**替代方案**：usePersona hook 内部管理 open 状态 → 耦合度高，不灵活。

### D2: 表单状态管理 — usePersona hook
将表单状态（name, description, personality, speechStyle, background, keyQuotes）、验证逻辑、保存逻辑集中在 `usePersona(bookId)` hook 中。

**理由**：分离 UI 和逻辑，hook 可独立测试，符合项目 hook 分离惯例（useReader, useBookshelf）。

**替代方案**：在组件内用 useState 管理所有字段 → 组件过于臃肿。

### D3: 一键生成 — stub 异步函数
"✨ 一键生成人设" 按钮调用 `generatePersona(bookId, name)` 异步函数。本次实现为 stub（返回占位数据），后续 change 替换为 RAG+LLM 实际调用。

**理由**：解耦 UI 和生成逻辑，允许并行开发。stub 使 UI 可独立验证。

### D4: 表单布局 — ScrollArea 包裹
生成结果区域使用 ScrollArea 包裹，避免内容过多时弹窗撑破屏幕。弹窗固定最大高度 `max-h-[85vh]`。

**理由**：角色设定内容较多（5个字段），需要可滚动区域。

### D5: keyQuotes 输入方式 — Textarea 换行分割
代表性台词使用 Textarea 输入，每行一句台词。保存时按 `\n` 分割为 `string[]`。

**理由**：最简单直观的多条输入方式，无需复杂的动态列表 UI。

**替代方案**：动态添加/删除输入框 → 复杂度高，性价比低。

### D6: 编辑模式 — 复用同一弹窗
新建和编辑角色复用同一个 PersonaConfigDialog。如果传入 `existingPersona` prop，则预填充表单。

**理由**：减少组件数量，新建和编辑的表单结构完全一致。

## Risks / Trade-offs

- **Risk**: stub 生成函数返回的占位数据可能让用户困惑 → Mitigation: 按钮文案明确标注"生成"，生成结果区域有明显分隔线
- **Risk**: Textarea 换行分割 keyQuotes 可能误分割含换行的长台词 → Mitigation: 可接受的 trade-off，实际使用中台词通常是单行
- **Trade-off**: 弹窗内滚动 vs 全屏表单 → 选择弹窗内滚动，保持上下文（阅读页可见）
