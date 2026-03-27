## Why

Phase 4（灵魂）需要角色配置能力。用户需要为书中角色创建、编辑和保存人设（Persona），作为后续沉浸式对话的基础。当前 `src/features/persona/components/` 目录为空，缺少 PersonaConfigDialog 组件。

## What Changes

- 新增 `PersonaConfigDialog` 组件：基于 shadcn/ui Dialog，提供角色名称、描述输入，一键生成人设按钮，生成结果展示与编辑，保存/取消操作
- 新增 `usePersona` hook：封装角色配置弹窗的状态管理逻辑（表单状态、生成状态、验证、保存）
- 新增 Textarea UI 组件：PersonaConfigDialog 需要多行文本输入，当前 shadcn/ui 缺少 Textarea 组件
- 新增 Label UI 组件：表单字段标签，当前 shadcn/ui 缺少 Label 组件

## Capabilities

### New Capabilities
- `persona-config-dialog`: PersonaConfigDialog 组件的 UI 结构、表单交互、生成触发、数据验证和保存行为
- `use-persona-hook`: usePersona hook 的状态管理、表单操作和 Store 交互逻辑

### Modified Capabilities
_(无现有 spec 需要修改)_

## Impact

- **新增文件**：`src/features/persona/components/PersonaConfigDialog.tsx`、`src/features/persona/hooks/usePersona.ts`、`src/shared/components/ui/textarea.tsx`、`src/shared/components/ui/label.tsx`
- **依赖**：使用现有 shadcn/ui Dialog、Button、Input、ScrollArea 组件 + 新增 Textarea、Label
- **Store 交互**：调用 `store.setPersona()` 和 `store.setActivePersona()` 写入角色数据
- **未来集成点**：PersonaGenerator 服务（当前为占位 stub，后续 change 实现 RAG+LLM 生成逻辑）
