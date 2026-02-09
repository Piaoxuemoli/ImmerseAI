## 1. Store 与类型扩展

- [x] 1.1 在 `src/shared/types/index.ts` 的 ImmerseStore 接口中新增 `llmConfig` (含 provider/baseUrl/model/temperature/maxTokens) 和 `bookshelfRootPath` 字段及对应 actions
- [x] 1.2 在 `src/shared/store/index.ts` 中实现 llmConfig / bookshelfRootPath 初始值、setLlmConfig / setBookshelfRootPath actions，并将两者加入 persist partialize

## 2. shadcn/ui 组件准备

- [x] 2.1 检查并安装缺失的 shadcn/ui 组件（Slider、Select、Separator、Card、Label 等）

## 3. SettingsPage 组件开发

- [x] 3.1 创建 `src/features/settings/SettingsPage.tsx`，搭建页面骨架（Header 含返回按钮 + 标题，两个 Card 区域：LLM 配置 / 书架配置）
- [x] 3.2 实现 LLM 配置区：Provider Select + Base URL Input + Model Input，Provider 切换时自动填充 Base URL
- [x] 3.3 实现 API Key 区：password Input + 保存按钮，页面加载时从 safeStorage 读取并掩码显示，保存时写入 safeStorage
- [x] 3.4 实现 Temperature 滑块 (0.0~1.0, step 0.1, default 0.7) + MaxTokens 滑块 (256~8192, step 256, default 2048)
- [x] 3.5 实现"测试连接"按钮：使用 llm:chat IPC 发送测试消息 (maxTokens=1)，显示成功/失败状态
- [x] 3.6 实现书架路径区：显示当前路径 + "更换目录"按钮调用 selectDirectory

## 4. 路由与导航

- [x] 4.1 在 `src/app/router.tsx` 注册 `/settings` 路由
- [x] 4.2 在 TopBar 齿轮按钮添加 `navigate('/settings')` onClick

## 5. 验证

- [x] 5.1 运行 `npx electron-vite build` 确认编译通过
