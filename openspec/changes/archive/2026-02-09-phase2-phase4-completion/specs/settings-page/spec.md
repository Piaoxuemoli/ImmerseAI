## MODIFIED Requirements

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

### Requirement: 书架路径配置
系统 SHALL 显示当前书架根路径并提供更换功能；**与 Store 字段名一致。**

#### Scenario: 路径显示
- **WHEN** 设置页面加载
- **THEN** 显示 Zustand Store 中的 `bookshelfRootPath` 值
- **AND** 如果为空，显示「未挂载」或「未设置」

#### Scenario: 更换目录
- **WHEN** 用户点击「更换目录」按钮
- **THEN** 调用 `window.electronAPI.app.selectDirectory()` 打开系统文件选择对话框
- **AND** 选择后更新 Zustand Store 中的 `bookshelfRootPath`（通过 setBookshelfRootPath）
