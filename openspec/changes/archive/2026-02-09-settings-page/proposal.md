## Why

用户目前无法在应用内配置 LLM 连接参数（Provider、API Key、Base URL、Model），也无法变更书架根路径。API Key 的 safeStorage 加密存取已在主进程实现，但缺少面向用户的设置界面。这是 Phase 4 剩余的最后一块拼图——没有设置页，AI 对话功能无法正常使用。

## What Changes

- 新增 `src/features/settings/SettingsPage.tsx`：完整的设置页面组件
- 新增 `/settings` 路由，并在 TopBar 齿轮按钮中导航至此
- Zustand Store 扩展：新增 `llmConfig` 状态字段（provider / baseUrl / model / temperature / maxTokens）并持久化到 localStorage
- 设置页可通过 IPC 调用 `app:get-safe-storage` / `app:set-safe-storage` 管理 API Key
- 提供"测试连接"按钮：发送轻量 LLM 请求验证 Key 有效性
- 书架路径显示 + "更换目录"按钮（调用 `app:selectDirectory`）

## Capabilities

### New Capabilities
- `settings-page`: 设置页面 UI、路由注册、表单交互与持久化存储

### Modified Capabilities
- `global-store`: ImmerseStore 新增 llmConfig / bookshelfRootPath 字段与对应 actions，persist 范围扩展

## Impact

- **新增文件**: `src/features/settings/SettingsPage.tsx`
- **修改文件**: `src/app/router.tsx`（新增 `/settings` 路由）、`src/shared/types/index.ts`（ImmerseStore 扩展）、`src/shared/store/index.ts`（状态 + actions + persist）、`src/features/bookshelf/components/TopBar.tsx`（齿轮按钮导航）
- **依赖**: shadcn/ui 的 Input / Select / Slider / Label / Separator / Button / Card 组件
- **IPC 通道**: 复用现有 `app:get-safe-storage`、`app:set-safe-storage`、`app:select-directory`
