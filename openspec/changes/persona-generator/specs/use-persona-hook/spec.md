## MODIFIED Requirements

### Requirement: 生成逻辑
usePersona hook SHALL 提供 generatePersona 方法调用真实的 persona-generator 服务。

#### Scenario: 生成前验证
- **WHEN** 调用 `generatePersona()` 且 form.name 为空
- **THEN** 设置 nameError 为 true
- **AND** 不调用生成服务

#### Scenario: 执行生成
- **WHEN** 调用 `generatePersona()` 且 form.name 不为空
- **THEN** 设置 isGenerating 为 true
- **AND** 调用 `generatePersona(bookId, form.name.trim())` 真实函数（从 persona-generator 模块导入）
- **AND** 完成后将结果填充到 form 对应字段（包括 description 仅在为空时填充）
- **AND** 设置 isGenerating 为 false

#### Scenario: 生成失败
- **WHEN** 生成服务抛出异常
- **THEN** 设置 isGenerating 为 false
- **AND** 不修改表单内容（保留用户已输入的值）

### Requirement: 保存逻辑
usePersona hook SHALL 提供 savePersona 方法构建 Persona 并写入 Store，包含 systemPrompt。

#### Scenario: 验证通过并保存
- **WHEN** 调用 `savePersona()` 且 form.name 不为空
- **THEN** 构建 Persona 对象：
  - id: 新角色使用 crypto.randomUUID()，编辑模式保留原 id
  - bookId: hook 参数传入的 bookId
  - keyQuotes: 将 keyQuotesText 按 `\n` 分割并过滤空行
  - systemPrompt: 使用最近一次生成返回的 systemPrompt（若未生成则为空字符串）
  - createdAt: 新角色用 Date.now()，编辑模式保留原值
  - updatedAt: Date.now()
- **AND** 调用 `store.setPersona(persona)`
- **AND** 调用 `store.setActivePersona(persona.id)`
- **AND** 返回 true 表示保存成功

#### Scenario: 验证失败
- **WHEN** 调用 `savePersona()` 且 form.name 为空
- **THEN** 设置 nameError 为 true
- **AND** 返回 false 表示保存失败
