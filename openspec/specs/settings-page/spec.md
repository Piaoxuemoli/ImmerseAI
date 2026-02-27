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

### Requirement: LLM 最小配置
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

### Requirement: API Key 安全管理
系统 SHALL 通过 Electron safeStorage IPC 管理 API Key，禁止存入 localStorage。**存储使用的 key 必须与 llm-handler 一致。**

#### Scenario: API Key 存储 key 名
- **WHEN** 读取或写入 API Key
- **THEN** 必须使用 key 名 `llm_api_key`（下划线）
- **AND** 即 `getSafeStorage('llm_api_key')` 与 `setSafeStorage('llm_api_key', value)`
- **AND** 与主进程 llm-handler 从 safeStorage 读取的 key 一致

#### Scenario: API Key 加载
- **WHEN** 设置页面加载
- **THEN** 通过 `window.electronAPI.app.getSafeStorage('llm_api_key')` 获取已存储的 Key
- **AND** 如果存在，Input 中显示掩码（如 `••••••` 或仅显示前几位与后几位）

#### Scenario: API Key 保存
- **WHEN** 用户输入新的 API Key 并触发保存或 onChange
- **THEN** 通过 `window.electronAPI.app.setSafeStorage('llm_api_key', value)` 加密存储
- **AND** 可选显示保存成功提示

#### Scenario: API Key 不进入 Store
- **WHEN** 查看 Zustand Store 和 localStorage
- **THEN** 不得包含 API Key 的明文或加密值

### Requirement: 测试连接
系统 SHALL 提供"测试连接"按钮验证 LLM API Key 和端点有效性。

#### Scenario: 测试成功
- **WHEN** 用户点击"测试连接"
- **THEN** 使用当前配置（从 Store 读取 baseUrl、model，从 safeStorage 读取 apiKey）发送一条测试消息（maxTokens=1）
- **AND** 收到响应后显示绿色 ✅ "连接成功"

#### Scenario: 测试失败
- **WHEN** 测试请求失败（网络错误、Key 无效、超时 10s）
- **THEN** 显示红色 ❌ 错误信息

#### Scenario: 测试中状态
- **WHEN** 测试请求正在进行
- **THEN** 按钮显示 loading 状态，禁止重复点击

### Requirement: 书架路径显示与更换
系统 SHALL 在设置页面显示当前书架根目录路径，并提供更换目录按钮。

#### Scenario: 显示当前路径
- **WHEN** 设置页面渲染
- **THEN** 从 Zustand Store 读取 `bookshelfRootPath` 显示在只读输入框中
- **AND** 如果为空显示"未设置"

#### Scenario: 更换书架目录
- **WHEN** 用户点击"更换目录"按钮
- **THEN** 调用 `window.electronAPI.app.selectDirectory()` 弹出系统目录选择对话框
- **AND** 用户选择目录后更新 Store 的 `bookshelfRootPath`
- **AND** 用户取消选择时不修改 Store
