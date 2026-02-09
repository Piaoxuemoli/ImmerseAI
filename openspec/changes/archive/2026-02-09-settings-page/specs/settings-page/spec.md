## ADDED Requirements

### Requirement: 设置页面路由与导航
系统 SHALL 在 `/settings` 路径注册设置页面，并从 TopBar 齿轮按钮可达。

#### Scenario: 路由注册
- **WHEN** 用户访问 `/settings`
- **THEN** 渲染 SettingsPage 组件
- **AND** 路由定义在 `src/app/router.tsx` 中

#### Scenario: TopBar 导航
- **WHEN** 用户点击 TopBar 的齿轮图标按钮
- **THEN** 导航到 `/settings` 页面

#### Scenario: 返回导航
- **WHEN** 用户在设置页面点击返回按钮
- **THEN** 导航回上一页（`/bookshelf`）

### Requirement: LLM Provider 配置
系统 SHALL 提供 LLM Provider 选择与连接参数配置表单。

#### Scenario: Provider 下拉选择
- **WHEN** 用户打开 Provider 下拉框
- **THEN** 显示选项：DeepSeek、Kimi、Moonshot、OpenAI、Custom
- **AND** 选择后即时更新 Zustand Store 中的 `llmConfig.provider`

#### Scenario: Provider 切换自动填充 Base URL
- **WHEN** 用户切换 Provider 为非 custom 值
- **THEN** Base URL 输入框自动填充对应默认值（deepseek→`https://api.deepseek.com/v1`，kimi/moonshot→`https://api.moonshot.cn/v1`，openai→`https://api.openai.com/v1`）
- **AND** 用户仍可手动覆盖

#### Scenario: Custom Provider
- **WHEN** 用户选择 custom Provider
- **THEN** Base URL 输入框清空，用户必须手动填写
- **AND** Model 名称输入框不受限制

#### Scenario: Model 名称输入
- **WHEN** 用户在 Model 输入框中输入模型名称
- **THEN** 即时更新 Zustand Store 中的 `llmConfig.model`

### Requirement: API Key 安全管理
系统 SHALL 通过 Electron safeStorage IPC 管理 API Key，禁止存入 localStorage。

#### Scenario: API Key 加载
- **WHEN** 设置页面加载
- **THEN** 通过 `window.electronAPI.app.getSafeStorage('llm-api-key')` 获取已存储的 Key
- **AND** 如果存在，Input 中显示掩码（如 `sk-****xxxx`，仅显示前3位和后4位）

#### Scenario: API Key 保存
- **WHEN** 用户输入新的 API Key 并触发保存
- **THEN** 通过 `window.electronAPI.app.setSafeStorage('llm-api-key', value)` 加密存储
- **AND** 显示保存成功提示

#### Scenario: API Key 不进入 Store
- **WHEN** 查看 Zustand Store 和 localStorage
- **THEN** 不得包含 API Key 的明文或加密值

### Requirement: Temperature 与 MaxTokens 滑块
系统 SHALL 提供 Temperature 和 MaxTokens 滑块控件。

#### Scenario: Temperature 滑块
- **WHEN** 用户拖动 Temperature 滑块
- **THEN** 值范围 0.0 ~ 1.0，步进 0.1，默认 0.7
- **AND** 即时更新 Zustand Store 中的 `llmConfig.temperature`
- **AND** 在滑块旁显示当前数值

#### Scenario: MaxTokens 滑块
- **WHEN** 用户拖动 MaxTokens 滑块
- **THEN** 值范围 256 ~ 8192，步进 256，默认 2048
- **AND** 即时更新 Zustand Store 中的 `llmConfig.maxTokens`
- **AND** 在滑块旁显示当前数值

### Requirement: 测试连接
系统 SHALL 提供"测试连接"按钮验证 LLM API Key 和端点有效性。

#### Scenario: 测试成功
- **WHEN** 用户点击"测试连接"
- **THEN** 使用当前配置（从 Store 读取 provider/baseUrl/model，从 safeStorage 读取 apiKey）发送一条测试消息（maxTokens=1）
- **AND** 收到响应后显示绿色 ✅ "连接成功"

#### Scenario: 测试失败
- **WHEN** 测试请求失败（网络错误、Key 无效、超时 10s）
- **THEN** 显示红色 ❌ 错误信息

#### Scenario: 测试中状态
- **WHEN** 测试请求正在进行
- **THEN** 按钮显示 loading 状态，禁止重复点击

### Requirement: 书架路径配置
系统 SHALL 显示当前书架根路径并提供更换功能。

#### Scenario: 路径显示
- **WHEN** 设置页面加载
- **THEN** 显示 Zustand Store 中的 `bookshelfRootPath` 值
- **AND** 如果为空，显示"未设置"

#### Scenario: 更换目录
- **WHEN** 用户点击"更换目录"按钮
- **THEN** 调用 `window.electronAPI.app.selectDirectory()` 打开系统文件选择对话框
- **AND** 选择后更新 Zustand Store 中的 `bookshelfRootPath`

### Requirement: UI 设计规范
系统 SHALL 遵循 Notion 极简风格，使用 shadcn/ui 组件。

#### Scenario: 组件选用
- **WHEN** 渲染设置页面
- **THEN** 使用 shadcn/ui 的 Input、Select、Slider、Label、Separator、Button、Card 组件
- **AND** 使用 lucide-react 图标

#### Scenario: 布局风格
- **WHEN** 排布设置项
- **THEN** 分区使用 Card 或 Separator 隔开（LLM 配置区 / 书架配置区）
- **AND** 遵循 slate 色系、Inter 字体、rounded-lg 圆角
