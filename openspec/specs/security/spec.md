# 安全规范

## 目的
定义 ImmerseAI 的安全边界和数据保护规则。

## 需求

### Requirement: API Key 保护
LLM API Key SHALL 使用 Electron safeStorage 加密存储。
API Key SHALL NOT 传递到渲染进程。
API Key SHALL NOT 出现在日志输出中。

### Requirement: Electron 安全配置
- nodeIntegration SHALL 为 false
- contextIsolation SHALL 为 true
- webSecurity SHALL 为 true

### Requirement: 数据本地化
书籍文件和向量索引 SHALL 完全存储在本地。
唯一允许的出站网络流量是 LLM API 调用。

### Requirement: MCP 沙箱
MCP Server SHALL 仅能访问用户显式选择的目录。
不得访问选定目录以外的文件系统路径。

### Requirement: IPC 白名单
preload.ts SHALL 仅暴露预定义的 channel 列表。
禁止使用通配符或动态 channel 名称。
