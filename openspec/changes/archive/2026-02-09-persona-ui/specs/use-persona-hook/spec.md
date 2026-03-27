## ADDED Requirements

### Requirement: usePersona hook 接口
usePersona(bookId) hook SHALL 返回 PersonaConfigDialog 所需的全部状态和操作。

#### Scenario: hook 返回值
- **WHEN** 调用 `usePersona(bookId)`
- **THEN** 返回以下字段和方法：
  - `form`: 包含 name, description, personality, speechStyle, background, keyQuotesText 的表单对象
  - `setField(field, value)`: 更新单个表单字段
  - `isGenerating`: 生成状态布尔值
  - `nameError`: 名称验证错误布尔值
  - `generatePersona()`: 触发异步生成
  - `savePersona()`: 验证并保存角色
  - `resetForm()`: 重置表单为初始值
  - `loadPersona(persona)`: 加载已有角色数据到表单

### Requirement: 表单状态管理
usePersona hook SHALL 管理所有表单字段的状态。

#### Scenario: 初始状态
- **WHEN** hook 初始化
- **THEN** 所有表单字段为空字符串
- **AND** isGenerating 为 false
- **AND** nameError 为 false

#### Scenario: 字段更新
- **WHEN** 调用 `setField('name', '章北海')`
- **THEN** `form.name` 更新为 '章北海'
- **AND** 如果字段为 name 且之前有 nameError，清除错误

### Requirement: 生成逻辑
usePersona hook SHALL 提供 generatePersona 方法调用生成服务。

#### Scenario: 生成前验证
- **WHEN** 调用 `generatePersona()` 且 form.name 为空
- **THEN** 设置 nameError 为 true
- **AND** 不调用生成服务

#### Scenario: 执行生成
- **WHEN** 调用 `generatePersona()` 且 form.name 不为空
- **THEN** 设置 isGenerating 为 true
- **AND** 调用 PersonaGenerator stub 函数
- **AND** 完成后将结果填充到 form 对应字段
- **AND** 设置 isGenerating 为 false

#### Scenario: 生成失败
- **WHEN** 生成服务抛出异常
- **THEN** 设置 isGenerating 为 false
- **AND** 不修改表单内容（保留用户已输入的值）

### Requirement: 保存逻辑
usePersona hook SHALL 提供 savePersona 方法构建 Persona 并写入 Store。

#### Scenario: 验证通过并保存
- **WHEN** 调用 `savePersona()` 且 form.name 不为空
- **THEN** 构建 Persona 对象：
  - id: 新角色使用 crypto.randomUUID()，编辑模式保留原 id
  - bookId: hook 参数传入的 bookId
  - keyQuotes: 将 keyQuotesText 按 `\n` 分割并过滤空行
  - systemPrompt: 空字符串
  - createdAt: 新角色用 Date.now()，编辑模式保留原值
  - updatedAt: Date.now()
- **AND** 调用 `store.setPersona(persona)`
- **AND** 调用 `store.setActivePersona(persona.id)`
- **AND** 返回 true 表示保存成功

#### Scenario: 验证失败
- **WHEN** 调用 `savePersona()` 且 form.name 为空
- **THEN** 设置 nameError 为 true
- **AND** 返回 false 表示保存失败

### Requirement: 加载已有角色
usePersona hook SHALL 提供 loadPersona 方法将已有 Persona 数据填充到表单。

#### Scenario: 加载角色数据
- **WHEN** 调用 `loadPersona(persona)`
- **THEN** 填充所有表单字段为该角色的值
- **AND** keyQuotes 数组以 `\n` 连接为 keyQuotesText
- **AND** 记录该角色的 id 和 createdAt 用于编辑保存
