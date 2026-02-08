## Context

**Current State:**
- 项目已集成 `@modelcontextprotocol/sdk` 依赖
- mcp-integration spec 已定义高层需求(连接管理、统一接口、安全边界)
- spike-mcp-client.ts 验证了 StdioClientTransport 的可行性
- Electron 主进程尚未实现任何 MCP 连接管理代码

**Problem:**
书架连接器(Bookshelf Connector)需要通过 MCP 协议访问本地文件系统,但缺少统一的连接管理层。每个功能模块独立创建 MCP Client 会导致:
- 子进程泄漏(未正确清理)
- 连接状态不一致
- 重复的错误处理逻辑

**Constraints:**
- 必须在 Electron 主进程中运行(渲染进程无法 spawn 子进程)
- 遵循宪法第三章 3.3 节的 Sidecar Pattern
- 严格参考 spike-mcp-client.ts 的 API 用法
- 连接失败必须自动重试,避免用户手动重启应用

**Stakeholders:**
- Bookshelf Connector(书架连接器) - 依赖 McpManager 提供文件操作能力
- IPC Handlers - 将 MCP 能力暴露给渲染进程
- 未来的 GitHub MCP Server 集成 - 需要统一的接口抽象

## Goals / Non-Goals

**Goals:**
1. 实现 McpManager 单例类,管理 MCP Server 子进程的完整生命周期
2. 提供 `connectLocal(path)` / `disconnect()` 方法,支持连接状态管理
3. 暴露统一的文件操作接口: `listFiles` / `readFile` / `writeFile` / `moveFile`
4. 实现连接失败自动重试机制(最多 3 次,间隔 2 秒)
5. 确保子进程正确清理(disconnect 时 kill 进程,避免僵尸进程)
6. 提供完整的 TypeScript 类型定义和错误处理

**Non-Goals:**
1. **不实现** IPC 桥接层(留给后续 change)
2. **不实现** BookshelfConnector 的高层抽象(留给后续 change)
3. **不集成** GitHub MCP Server(未来扩展,本次仅支持 local filesystem)
4. **不实现** 连接池或多实例管理(单例模式足够)
5. **不实现** 文件监听/热重载(MCP Server 不支持)

## Decisions

### D1: 单例模式 vs 工厂模式

**选择:** 单例模式

**理由:**
- ImmerseAI 的使用场景下,用户同一时间只会连接一个书架(本地目录或 GitHub repo)
- 单例简化状态管理,避免多个 MCP Client 实例竞争资源
- 宪法第三章 3.3 节明确要求 McpManager 为单例

**替代方案:**
- 工厂模式 - 支持多实例,但增加复杂度且无实际需求
- 静态类 - 无法 mock,不利于测试

**权衡:**
- ✅ 简化连接状态管理
- ✅ 避免子进程泄漏
- ❌ 未来若支持"同时打开多个书架",需重构为工厂模式

### D2: StdioClientTransport vs SSE Transport

**选择:** StdioClientTransport(标准输入输出)

**理由:**
- 本地 filesystem server 通过 stdio 通信,无需网络开销
- spike-mcp-client.ts 已验证可行性
- 子进程生命周期完全受主进程控制,易于管理

**替代方案:**
- SSE Transport - 用于 HTTP-based MCP Server(如 GitHub API),本次不涉及
- WebSocket - 过度设计,stdio 已满足需求

**权衡:**
- ✅ 零网络延迟
- ✅ 简单可靠,无需处理网络错误
- ❌ 无法跨机器通信(但本地书库场景不需要)

### D3: 重试逻辑实现策略

**选择:** 指数退避 + 最大重试 3 次

**实现细节:**
```typescript
// 重试间隔: 2s, 4s, 8s (指数退避)
const RETRY_DELAYS = [2000, 4000, 8000];
const MAX_RETRIES = 3;
```

**理由:**
- MCP Server 子进程启动失败通常是暂时性问题(如 npx 首次下载依赖)
- 指数退避避免频繁重试导致系统负载
- 3 次重试后仍失败,说明是配置问题(如路径无效),应立即报错

**替代方案:**
- 固定间隔重试 - 无法应对网络抖动
- 无限重试 - 可能导致应用卡死
- 手动重试 - 增加用户操作成本

**权衡:**
- ✅ 平衡鲁棒性和响应速度
- ❌ 总重试时间最长 14 秒,用户可能感知延迟

### D4: 错误处理策略

**选择:** 分层错误处理 + 自定义错误类型

**实现:**
```typescript
class McpConnectionError extends Error {
  constructor(
    message: string,
    public readonly code: 'SPAWN_FAILED' | 'HANDSHAKE_TIMEOUT' | 'SERVER_CRASHED',
    public readonly retriesLeft: number
  ) {
    super(message);
    this.name = 'McpConnectionError';
  }
}
```

**理由:**
- 区分不同错误类型,便于上层调用者针对性处理
- 提供重试次数信息,便于 UI 展示连接状态
- 遵循 TypeScript 最佳实践

**替代方案:**
- 仅返回字符串错误 - 缺少结构化信息
- 使用通用 Error - 无法区分错误类型
- Result<T, E> 模式 - 过度设计,JavaScript 生态不常用

**权衡:**
- ✅ 清晰的错误分类
- ✅ 便于日志记录和调试
- ❌ 增加代码量

### D5: npx vs 全局安装 @modelcontextprotocol/server-filesystem

**选择:** npx -y @modelcontextprotocol/server-filesystem

**理由:**
- 用户无需手动全局安装依赖,降低配置门槛
- npx 自动使用最新版本,避免版本不一致问题
- `-y` 参数避免首次运行时的交互式确认

**替代方案:**
- 全局安装 - 需要文档说明,增加安装步骤
- 项目依赖 - server 应独立运行,不应打包进 Electron app
- 内置二进制 - 需要处理跨平台编译,维护成本高

**权衡:**
- ✅ 零配置,开箱即用
- ❌ 首次启动时 npx 下载依赖可能耗时(但有重试机制兜底)

### D6: 文件操作接口设计

**选择:** 直接暴露 MCP Tools,而非自定义抽象层

**实现:**
```typescript
async listFiles(path: string): Promise<FileEntry[]> {
  const result = await this.client.request({
    method: "tools/call",
    params: { name: "list_directory", arguments: { path } }
  }, CallToolResultSchema);
  // 直接返回 MCP 工具结果,最小化封装
}
```

**理由:**
- MCP Tools 的 schema 已经足够语义化
- 避免过度抽象导致 API 不一致
- 未来切换到 GitHub MCP Server 时,接口保持兼容

**替代方案:**
- 封装为 Node.js fs 风格 API - 增加学习成本,且 MCP 不完全对齐 fs
- 暴露 raw MCP client - 调用者需重复处理错误和 schema 解析

**权衡:**
- ✅ API 简洁,易于理解
- ✅ 与 MCP 生态对齐
- ❌ 调用者需了解 MCP Tools 的返回格式(但 TypeScript 类型可保障)

## Risks / Trade-offs

### R1: npx 首次下载依赖导致启动延迟
**风险:** 用户首次运行时,npx 需下载 @modelcontextprotocol/server-filesystem,可能耗时 10-30 秒

**缓解:**
- 重试机制给予足够时间(最长 14 秒重试窗口)
- UI 层展示"正在初始化书架连接..."加载状态
- 文档说明首次启动可能较慢

### R2: 子进程僵尸问题
**风险:** disconnect() 调用失败或主进程崩溃时,MCP Server 子进程可能变为僵尸进程

**缓解:**
- 使用 `child_process.kill()` 强制终止
- 监听主进程退出事件(`app.on('quit')` 或 `process.on('exit')`),确保清理
- 子进程设置超时自动退出(通过环境变量或 signal)

### R3: 并发调用导致状态不一致
**风险:** 多个模块同时调用 `connectLocal()` 或 `listFiles()`,可能导致竞态条件

**缓解:**
- `connectLocal()` 内部检查当前连接状态,重复调用直接返回
- 使用 Promise 队列(如 p-queue)串行化文件操作(但本次不实现,因实际场景中并发调用很少)
- 调用者遵循约定:启动时连接一次,运行期间不重复连接

### R4: 错误信息对用户不友好
**风险:** MCP Server 返回的错误信息可能是开发者导向(如 JSON-RPC 错误码),用户难以理解

**缓解:**
- McpManager 捕获常见错误并转换为用户友好描述:
  - "目录不存在" -> "无法访问所选文件夹,请检查路径"
  - "权限被拒绝" -> "没有读取该文件夹的权限"
- 在 IPC 层进一步优化错误提示(本次不涉及)

### R5: Windows 路径兼容性问题
**风险:** Windows 路径使用反斜杠 `\`,而 MCP Server 可能期望正斜杠 `/`

**缓解:**
- 所有路径参数统一使用 `path.normalize()` 处理
- 测试覆盖 Windows / macOS / Linux 三平台
- spike 验证中已测试跨平台兼容性(待确认)

## Migration Plan

**部署步骤:**
1. 创建 `electron/main/mcp-manager.ts` 文件
2. 在 `electron/main/index.ts` 中导入但**不立即使用**(避免影响现有功能)
3. 单元测试验证连接/重试/清理逻辑
4. 集成测试:在真实 Electron 环境中 spawn 子进程
5. 下一个 change 中,IPC Handlers 开始调用 McpManager

**回滚策略:**
- 本次 change 不影响现有代码,无需回滚
- 如发现问题,简单移除 mcp-manager.ts 文件即可

**兼容性影响:**
- 无 Breaking Changes
- 纯新增代码,零向后兼容风险

## Open Questions

**Q1: 是否需要支持自定义 MCP Server 路径?**
- 当前设计硬编码使用 npx @modelcontextprotocol/server-filesystem
- 未来可能需要支持用户提供自己的 MCP Server 可执行文件路径
- **决策:** 本次不支持,后续根据需求扩展

**Q2: 是否需要暴露 MCP Resources 能力?**
- MCP SDK 支持 Resources(类似 REST API 的 GET /resource),但 filesystem server 主要基于 Tools
- **决策:** 本次仅实现 Tools 能力,Resources 留待未来扩展

**Q3: 日志级别如何配置?**
- MCP Server 子进程的 stderr 输出应该如何处理(展示给用户 / 写入日志文件 / 静默忽略)
- **决策:** 本次将 stderr 通过 Electron log 记录,便于调试,不展示给用户
