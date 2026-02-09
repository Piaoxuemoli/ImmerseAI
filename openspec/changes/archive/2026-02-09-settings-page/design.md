## Context

ImmerseAI 的 LLM 对话功能（Phase 4）已实现主进程 llm-handler + safeStorage，但缺少用户侧设置界面。当前状态：

- `electron/main/safe-storage.ts` — 完整的 get/set/delete API，IPC 已注册
- `electron/preload/index.ts` — 已暴露 `app.getSafeStorage` / `app.setSafeStorage` / `app.selectDirectory`
- `src/shared/store/index.ts` — Zustand Store 仅持久化 books/personas/currentSession，无 LLM 配置
- `src/app/router.tsx` — 仅 `/bookshelf` 和 `/reader/:id`，无 `/settings`

用户需要一个设置页面来输入 API Key、选择 Provider、调整参数，否则对话功能不可用。

## Goals / Non-Goals

**Goals:**
- 提供完整的 LLM 配置 UI（Provider / API Key / Base URL / Model / Temperature / MaxTokens）
- API Key 通过 safeStorage 加密存储，不进入 localStorage
- 所有非敏感配置即时持久化到 Zustand Store + localStorage
- 书架路径显示与更换
- 测试连接功能验证 API Key 有效性
- 注册 `/settings` 路由，TopBar 齿轮按钮可达

**Non-Goals:**
- 不实现主题切换（dark/light），留给后续 Phase
- 不实现多 LLM Provider 配置文件（同时只保存一组配置）
- 不实现字体大小调整（阅读器内部设置，不在此页面）

## Decisions

### D1: API Key 存储分离策略
**决定**：API Key 仅通过 IPC 存储在 safeStorage，不放入 Zustand Store。页面加载时通过 IPC 读取（掩码显示），保存时通过 IPC 写入。

**理由**：核心原则 P-1 要求零泄露。localStorage 是明文，safeStorage 使用 OS 级加密。Zustand persist 会将数据写入 localStorage，API Key 绝不能进入。

**替代方案**：在 Store 中存储加密后的 Key → 增加复杂度且不如 OS 级加密安全。

### D2: Provider 与 Base URL 映射
**决定**：选择 Provider 时自动填充默认 Base URL，用户可覆盖。映射表：
- deepseek → `https://api.deepseek.com/v1`
- kimi → `https://api.moonshot.cn/v1`
- moonshot → `https://api.moonshot.cn/v1`
- openai → `https://api.openai.com/v1`
- custom → 空，用户自行填写

**理由**：减少用户输入负担，同时保留 custom 的灵活性。

### D3: 测试连接实现
**决定**：通过现有 `llm:chat` IPC 发送一条 `[{ role: 'user', content: 'ping' }]` 消息，maxTokens 设为 1。成功收到任何 chunk 即视为通过。

**理由**：复用已有 LLM handler，无需新增 IPC 通道。超时 10 秒。

### D4: Store 扩展——新增 llmConfig 字段
**决定**：在 ImmerseStore 中新增 `llmConfig` 对象（不含 apiKey）和 `bookshelfRootPath` 字符串，加入 persist partialize。

**理由**：与 AppConfig 类型对齐，persist 确保刷新后配置不丢失。

## Risks / Trade-offs

- **[Risk] API Key 输入时短暂可见** → Input type="password"，且不做 console.log
- **[Risk] 测试连接消耗 Token** → maxTokens=1 最小化消耗，约 0.001 分钱
- **[Risk] shadcn/ui Slider 组件可能未安装** → 需检查并 add（`npx shadcn@latest add slider`）
- **[Risk] Provider 切换后 Base URL 残留** → 切换 Provider 时重置 Base URL 为默认值
