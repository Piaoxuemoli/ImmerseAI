# Agent 项目框架总结

> 更新时间: 2026-03-29
> 项目路径: `C:\Users\Qoobeewang\Desktop\agents`

---

## 一、项目概览

| 项目 | 定位 | 技术栈 | 架构模式 |
|------|------|--------|----------|
| **openclaw-main** | 多渠道 AI 网关，连接消息平台与 AI 编码助手 | TypeScript (Node 22+), pnpm, Vitest, tsdown | Gateway + Plugin 架构 |
| **edict-main** | 多 Agent 协作框架，模拟中国古代三省六部制 | Python FastAPI + React 18, PostgreSQL, Redis | 三省六部工作流 + OpenClaw |

---

## 二、OpenClaw 架构

### 2.1 核心定位
- **多渠道 AI 网关**：桥接 WhatsApp/Telegram/Discord/Slack 等消息平台与 AI Agent
- **自托管**：运行在用户本地硬件（`ws://127.0.0.1:18789`）
- **单控制平面**：通过 WebSocket 管理 sessions、channels、tools、cron、webhooks

### 2.2 目录结构

```
openclaw-main/
├── src/                      # 主源码 (TypeScript)
│   ├── cli/                  # CLI 入口和命令解析
│   ├── gateway/             # WebSocket 网关核心
│   │   ├── protocol/        # 协议 schema
│   │   ├── server/          # HTTP/WS 服务实现
│   │   └── server-methods/  # RPC 方法
│   ├── plugins/             # 插件发现、加载、注册
│   ├── plugin-sdk/          # 插件作者 SDK
│   ├── channels/            # 内置渠道实现
│   ├── sessions/            # Session 管理
│   ├── routing/             # 消息路由
│   ├── media/               # 媒体处理 (图片/音频/视频)
│   ├── mcp/                 # MCP (Model Context Protocol) 集成
│   ├── cron/                # 定时任务调度
│   ├── hooks/               # Hook 扩展系统
│   └── [40+ tool dirs]      # 工具实现 (browser, canvas, discord, etc.)
├── extensions/              # 插件包 (100+)
│   ├── anthropic/, openai/, google/   # 模型提供商
│   ├── telegram/, discord/, slack/    # 渠道插件
│   ├── memory-core/, memory-lancedb/  # 记忆插件
├── packages/                # 内部包 (moltbot 主机器人)
├── apps/                    # 配套应用 (macOS/iOS/Android)
├── ui/                      # Web UI (控制面板)
└── skills/                  # 技能集 (50+)
```

### 2.3 核心组件

#### Gateway (网关)
- WebSocket 控制平面 + HTTP (UI/webhooks)
- Session 隔离 (per-workspace/per-sender)
- 协议版本化管理 (`src/gateway/protocol/`)

#### Plugin System (插件系统)
- **Provider 插件**: OpenAI, Anthropic, Google 等模型
- **Channel 插件**: Telegram, Discord, WhatsApp 等消息渠道
- **Memory 插件**: LanceDB 等持久化存储
- 公共契约定义在 `src/plugin-sdk/*.ts`

#### Tool System (工具系统)
- 浏览器控制、Canvas 可视化工作区
- 设备节点 (iOS/Android 相机、屏幕、位置)
- 定时任务、Webhook、Sessions 管理

#### Cron/Automation
- 支持 `at`(一次性)、`every`(间隔)、`cron`(5字段表达式)
- 执行模式: `main`, `isolated`, `current`, `session:<id>`
- 投递方式: `announce`, `webhook`, `none`

### 2.4 技术特性
- **多渠道**: 20+ 内置渠道 + 扩展插件
- **多 Agent**: per-workspace 会话隔离
- **语音**: macOS/iOS/Android 语音唤醒 + 对话模式
- **Canvas**: Agent 驱动的可视化工作区
- **安全**: 配对制 DM 访问、白名单、沙箱模式

---

## 三、Edict (三省六部) 架构

### 3.1 核心定位
- **多 Agent 协作框架**，模拟中国古代三省六部官僚制度
- **强制性审查机制**：任何计划必须经过门下省审核才能执行
- 运行于 OpenClaw 之上

### 3.2 三省六部结构

```
用户 (皇帝)
    │
    ▼
太子 (Crown Prince) ─────── 消息分流 (chat vs. edict)
    │                        闲聊 → 直接回复
    │                        旨意 → 创建任务
    ▼
中书省 (Chancellery) ─────── 规划 (起草执行计划)
    │
    ▼
门下省 (Secretariat) ─────── 审核 (批准或驳回)
    │                         ❌ 驳回 → 返回中书省 (最多3轮)
    │                         ✅ 批准 → 继续执行
    ▼
尚书省 (Cabinet) ─────────── 调度 (协调六部)
    │
    ├─────────────────────────┬─────────────────┬─────────────┐
    ▼                         ▼                 ▼             ▼
户部    礼部            兵部            刑部           工部
(数据)  (文档)           (代码)          (合规)         (基础设施)
                                                            ▼
                                                       吏部
                                                      (人事)
```

### 3.3 目录结构

```
edict-main/
├── agents/                    # 12 个 Agent 角色模板 (SOUL.md 文件)
│   ├── taizi/                # 太子 - 消息分流
│   ├── zhongshu/             # 中书省 - 规划
│   ├── menxia/               # 门下省 - 审核/批准
│   ├── shangshu/             # 尚书省 - 调度
│   ├── hubu/                 # 户部 - 数据
│   ├── libu/                 # 礼部 - 文档
│   ├── bingbu/               # 兵部 - 代码
│   ├── xingbu/               # 刑部 - 合规
│   ├── gongbu/               # 工部 - 基础设施
│   ├── libu_hr/              # 吏部 - 人事
│   └── zaochao/              # 早朝 - 新闻聚合
│
├── edict/                    # 新版后端 + 前端 (FastAPI + React)
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py      # FastAPI 入口
│   │   │   ├── config.py    # 配置
│   │   │   ├── db.py        # 数据库
│   │   │   ├── api/         # REST API
│   │   │   ├── channels/    # 渠道集成 (飞书/Telegram/Discord)
│   │   │   ├── models/       # 数据模型
│   │   │   ├── services/    # 业务逻辑
│   │   │   └── workers/      # 后台工作者
│   │   └── requirements.txt
│   └── frontend/
│       ├── src/
│       │   ├── App.tsx      # React 主组件
│       │   ├── store.ts     # Zustand 状态管理
│       │   └── components/  # 13 个 React 组件
│       └── package.json     # React 18 + Vite + Zustand + TailwindCSS
│
├── dashboard/                # 旧版仪表盘 (HTML + Python)
│   ├── dashboard.html       # 单文件 (~2500行)
│   └── server.py            # Python HTTP 服务
│
├── scripts/                 # CLI 工具
│   ├── kanban_update.py     # 任务操作 (create/state/flow/progress/done)
│   └── skill_manager.py     # 技能管理
│
└── docs/
    ├── task-dispatch-architecture.md  # 架构文档 (1600+ 行)
    └── getting-started.md
```

### 3.4 任务状态机 (9个状态)

```
Pending → Taizi → Zhongshu → Menxia → Assigned → Doing → Review → Done
                   ↑            │                      │
                   └──── Reject ─┘               Blocked/Cancelled
```

### 3.5 权限矩阵

| From/To | 太子 | 中书省 | 门下省 | 尚书省 | 六部 |
|---------|------|--------|--------|--------|------|
| **太子** | - | ✅ | | | |
| **中书省** | ✅ | - | ✅ | ✅ | |
| **门下省** | | ✅ | - | ✅ | |
| **尚书省** | | ✅ | ✅ | - | ✅ (all 6) |
| **六部** | | | | ✅ | |

**强制规则:**
- 禁止越级 (中书省不能直接调用尚书省)
- 门下省必须审核所有计划
- 六部之间不能互相调用

### 3.6 事件驱动通信

```python
# 事件主题
task.created, task.planning, task.review.request, task.review.result
task.dispatch, agent.thoughts, agent.todo.update, task.status, heartbeat

# 事件结构
{
  "event_id": "uuid",
  "trace_id": "task-uuid",
  "timestamp": "ISO8601",
  "topic": "agent.thoughts",
  "event_type": "thought.append",
  "producer": "planning-agent:v1",
  "payload": { ... },
  "meta": { "priority": "normal", "model": "gpt-5-thinking" }
}
```

### 3.7 核心 CLI

```bash
# 创建任务
python3 scripts/kanban_update.py create JJC-YYYYMMDD-NNN "title" Zhongshu 中书省 中书令

# 更新状态
python3 scripts/kanban_update.py state JJC-xxx Menxia "方案提交审议"

# 添加流程日志
python3 scripts/kanban_update.py flow JJC-xxx "中书省" "门下省" "📋 提交审核"

# 完成任务
python3 scripts/kanban_update.py done JJC-xxx "<output>" "<summary>"
```

### 3.8 自恢复系统

停滞 180+ 秒的任务触发自动恢复:
1. **重试** → 重新调度到 Agent
2. **升级到门下省** → 人为协调
3. **升级到尚书省** → 执行干预
4. **自动回滚** → 恢复到上一个稳定状态

---

## 四、对比分析

| 特性 | CrewAI | AutoGen | **OpenClaw** | **Edict** |
|------|--------|---------|-------------|-----------|
| 审查机制 | ❌ | 可选 | ❌ | ✅ 门下省强制 |
| 实时仪表盘 | ❌ | ❌ | ✅ | ✅ (10个面板) |
| 多渠道支持 | ❌ | ❌ | ✅ (20+) | ✅ (通过 OpenClaw) |
| 任务干预 | ❌ | ✅ (手动) | ✅ | ✅ (一键停止/取消) |
| 流程审计 | 有限 | 有限 | 完整 | 完整 (59 events/task) |
| 权限矩阵 | ❌ | ❌ | ❌ | ✅ (配置驱动) |
| 自动恢复 | ❌ | ❌ | ❌ | ✅ (4阶段) |
| Plugin 系统 | ✅ | ✅ | ✅ (100+ extensions) | ❌ (依赖 OpenClaw) |

---

## 五、关键文件索引

### OpenClaw
| 文件 | 用途 |
|------|------|
| `openclaw.mjs` | CLI 入口 |
| `src/entry.ts` | CLI 启动逻辑 |
| `src/gateway/server.impl.ts` | 网关核心 (~87KB) |
| `src/plugin-sdk/index.ts` | 插件 SDK |
| `AGENTS.md` | 仓库指南 |
| `VISION.md` | 项目方向 |

### Edict
| 文件 | 用途 |
|------|------|
| `agents.json` | Agent 配置和权限矩阵 |
| `edict_agent_architecture.md` | 事件 schema、WebSocket 协议 |
| `docs/task-dispatch-architecture.md` | 综合架构文档 (1600+ 行) |
| `scripts/kanban_update.py` | 任务操作引擎 |

---

## 六、技术栈总结

| 项目 | 语言 | 框架 | 数据库 | 构建工具 |
|------|------|------|--------|----------|
| **OpenClaw** | TypeScript | Node 22+, Vitest | JSON 文件存储 | tsdown, pnpm |
| **Edict** | Python + TypeScript | FastAPI + React 18 | PostgreSQL + Redis | Vite |
