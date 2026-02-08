// docs/spikes/spike-mcp-client.ts
// 最小化示例：如何通过 StdioClientTransport 连接 MCP Filesystem Server
// 来源: https://modelcontextprotocol.info/docs/tutorials/building-a-client-node/

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListToolsResultSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

async function main() {
  // 1. 创建 Stdio 传输层 —— 启动 MCP Server 子进程
  const transport = new StdioClientTransport({
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/Users/yourname/Books"  // 挂载的本地目录
    ],
  });

  // 2. 创建 MCP Client 实例
  const client = new Client(
    { name: "immerseai-client", version: "1.0.0" },
    { capabilities: {} }
  );

  // 3. 连接
  await client.connect(transport);
  console.log("✅ MCP Connected");

  // 4. 列出可用工具
  const tools = await client.request(
    { method: "tools/list" },
    ListToolsResultSchema
  );
  console.log("Available tools:", tools.tools.map(t => t.name));
  // 预期输出: ["read_file", "write_file", "list_directory", "move_file", ...]

  // 5. 调用工具：列出目录
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "list_directory",
        arguments: { path: "/Users/yourname/Books" }
      }
    },
    CallToolResultSchema
  );
  console.log("Directory listing:", result);

  // 6. 调用工具：读取文件
  const fileResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "read_file",
        arguments: { path: "/Users/yourname/Books/三体.epub" }
      }
    },
    CallToolResultSchema
  );
  console.log("File content type:", typeof fileResult.content);

  // 7. 清理
  await client.close();
}

main().catch(console.error);
