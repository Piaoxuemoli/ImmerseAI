# 设置页 — Delta（LLM 仅保留 Base URL、API Key、Model）

## MODIFIED Requirements

### Requirement: LLM Provider 配置 → LLM 最小配置
系统 SHALL 提供 LLM 连接的最小配置：Base URL、API Key、Model。**不区分 Provider，不提供 Provider 下拉选择；** 统一为 OpenAI 兼容单一入口。

#### Scenario: Base URL 输入
- **WHEN** 用户在 Base URL 输入框中输入或修改
- **THEN** 即时更新 Zustand Store 中的 `llmConfig.baseUrl`（或等价字段）
- **AND** 无 Provider 切换自动填充；用户自行填写（如 `https://api.openai.com/v1` 或自定义）

#### Scenario: Model 名称输入
- **WHEN** 用户在 Model 输入框中输入模型名称
- **THEN** 即时更新 Zustand Store 中的 `llmConfig.model`

#### Scenario: 无 Provider 选择
- **WHEN** 用户打开设置页
- **THEN** 不显示 Provider 下拉框（DeepSeek/Kimi/Moonshot/OpenAI/Custom）
- **AND** 调用 LLM 时统一使用 Store 的 baseUrl + apiKey（safeStorage）+ model

## REMOVED Requirements

### Requirement: Provider 下拉选择
**Reason:** 不区分 Provider，统一 OpenAI 兼容入口。
**Migration:** 用户手动填写 Base URL 与 Model 即可。

### Requirement: Provider 切换自动填充 Base URL
**Reason:** 已移除 Provider 选择。
**Migration:** 无。

### Requirement: Custom Provider
**Reason:** 已移除 Provider 概念。
**Migration:** 无。

### Requirement: Temperature 与 MaxTokens 滑块
**Reason:** LLM 配置极简，仅保留 Base URL、API Key、Model。
**Migration:** 若后端需要默认值，在代码中使用固定默认（如 temperature=0.7、maxTokens=2048），不在 UI 暴露。

## MODIFIED Requirements（续）

### Requirement: 测试连接
系统 SHALL 提供「测试连接」按钮验证 LLM API Key 和端点有效性。

#### Scenario: 测试成功
- **WHEN** 用户点击「测试连接」
- **THEN** 使用当前配置（从 Store 读取 baseUrl、model，从 safeStorage 读取 apiKey）发送一条测试消息（maxTokens=1）
- **AND** 收到响应后显示绿色 ✅「连接成功」

#### Scenario: 测试失败
- **WHEN** 测试请求失败（网络错误、Key 无效、超时 10s）
- **THEN** 显示红色 ❌ 错误信息

#### Scenario: 测试中状态
- **WHEN** 测试请求正在进行
- **THEN** 按钮显示 loading 状态，禁止重复点击
