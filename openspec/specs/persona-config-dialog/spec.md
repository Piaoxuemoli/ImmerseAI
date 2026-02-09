# 角色配置弹窗规范

## 目的
定义 PersonaConfigDialog 组件的 UI 结构、表单交互、生成触发、数据验证和保存行为。

## Requirements

### Requirement: Dialog 基本结构
PersonaConfigDialog SHALL 使用 shadcn/ui Dialog 组件，通过 `open` 和 `onOpenChange` props 实现受控模式。

#### Scenario: 弹窗打开
- **WHEN** 父组件设置 `open={true}`
- **THEN** 渲染 Dialog 弹窗
- **AND** 弹窗标题为 "🎭 角色配置"
- **AND** 弹窗内容区域最大高度为 `max-h-[85vh]`，使用 ScrollArea 包裹

#### Scenario: 弹窗关闭
- **WHEN** 用户点击关闭按钮或弹窗外区域
- **THEN** 调用 `onOpenChange(false)` 通知父组件
- **AND** 表单状态不自动清空（由 hook 控制）

### Requirement: 角色名称输入
PersonaConfigDialog SHALL 提供角色名称输入框，为必填字段。

#### Scenario: 输入角色名称
- **WHEN** 弹窗打开
- **THEN** 显示 Label 为 "角色名称" 的 Input 输入框
- **AND** 输入框 placeholder 为 "如：章北海、林黛玉..."

#### Scenario: 名称为空时保存
- **WHEN** 用户点击"保存角色"且名称为空
- **THEN** 阻止保存操作
- **AND** 名称输入框显示错误样式（红色边框）

### Requirement: 角色描述输入
PersonaConfigDialog SHALL 提供角色描述 Textarea，为可选字段。

#### Scenario: 输入描述
- **WHEN** 弹窗打开
- **THEN** 显示 Label 为 "角色描述" 的 Textarea
- **AND** placeholder 为 "简要描述角色特征（可选）"

### Requirement: 一键生成人设按钮
PersonaConfigDialog SHALL 提供 "✨ 一键生成人设" 按钮，触发 PersonaGenerator 服务。

#### Scenario: 触发生成
- **WHEN** 用户点击 "✨ 一键生成人设" 按钮
- **THEN** 调用异步生成函数，传入 bookId 和角色名称
- **AND** 按钮显示加载状态（Loader2 旋转图标 + "生成中..."）
- **AND** 按钮在加载期间 disabled

#### Scenario: 名称为空时点击生成
- **WHEN** 用户未输入角色名称时点击生成按钮
- **THEN** 不触发生成
- **AND** 角色名称输入框显示错误提示

#### Scenario: 生成完成
- **WHEN** 生成函数返回结果
- **THEN** 自动填充 personality、speechStyle、background、keyQuotes 字段
- **AND** description 字段若为空则也自动填充

### Requirement: 生成结果展示与编辑
PersonaConfigDialog SHALL 在生成后展示并允许编辑性格特征、说话风格、代表台词、背景故事。

#### Scenario: 展示生成区域
- **WHEN** 弹窗打开（无论是否已生成）
- **THEN** 在分隔线下方显示四个 Textarea 字段：
  - "性格特征"（personality）
  - "说话风格"（speechStyle）
  - "背景故事"（background）
  - "代表性台词"（keyQuotes，每行一句）

#### Scenario: 手动编辑
- **WHEN** 用户修改任意已生成字段的内容
- **THEN** 字段值实时更新
- **AND** 不影响其他字段

### Requirement: 保存角色
PersonaConfigDialog SHALL 提供 "保存角色" 按钮，验证必填字段后写入 Zustand Store。

#### Scenario: 保存成功
- **WHEN** 用户点击"保存角色"且 name 不为空
- **THEN** 构建完整 Persona 对象（含 id、bookId、timestamps）
- **AND** 调用 `store.setPersona(persona)` 写入 Store
- **AND** 调用 `store.setActivePersona(persona.id)` 设为活跃角色
- **AND** 调用 `onOpenChange(false)` 关闭弹窗

#### Scenario: Persona 数据结构
- **WHEN** 保存角色
- **THEN** Persona 对象 SHALL 严格遵循宪法第五章 Persona 接口
- **AND** id 为 UUID v4
- **AND** createdAt 和 updatedAt 使用 Date.now()
- **AND** systemPrompt 为空字符串（后续 change 生成）

### Requirement: 编辑已有角色
PersonaConfigDialog SHALL 支持传入 `existingPersona` prop 进入编辑模式。

#### Scenario: 编辑模式
- **WHEN** 传入 `existingPersona` prop
- **THEN** 表单所有字段预填充为已有角色的值
- **AND** keyQuotes 数组以换行符连接为字符串显示

#### Scenario: 编辑保存
- **WHEN** 编辑模式下点击保存
- **THEN** 保留原 Persona 的 id 和 createdAt
- **AND** 更新 updatedAt 为当前时间戳

### Requirement: 取消操作
PersonaConfigDialog SHALL 提供 "取消" 按钮。

#### Scenario: 点击取消
- **WHEN** 用户点击"取消"按钮
- **THEN** 调用 `onOpenChange(false)` 关闭弹窗
- **AND** 不保存任何更改
