/**
 * McpManager - 单例类,管理 MCP (Model Context Protocol) 连接和文件操作
 * 
 * 职责:
 * - 通过 StdioClientTransport 连接本地 MCP Filesystem Server
 * - 提供统一的文件操作接口 (listFiles, readFile, writeFile, moveFile)
 * - 连接失败自动重试(指数退避, 最多 3 次)
 * - 管理子进程生命周期,确保正确清理
 * 
 * 参考: docs/spikes/spike-mcp-client.ts
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

// ============================================
// MCP Server 启动配置
// ============================================

/**
 * 获取 MCP server-filesystem 的启动配置
 * 
 * 开发模式: 使用 npx 启动
 * 打包模式: 使用 Electron 作为 Node.js 运行 (ELECTRON_RUN_AS_NODE=1)
 * 
 * @param localPath - 要挂载的本地目录路径
 * @returns StdioClientTransport 所需的 command, args, env
 */
function getMcpServerConfig(localPath: string): { 
  command: string; 
  args: string[]; 
  env?: Record<string, string>;
} {
  if (app.isPackaged) {
    // 打包模式: 使用预先 esbuild 打包好的自包含 ESM bundle (mcp-server.mjs)
    // 该 bundle 位于 extraResources 目录，完全独立，无需 ASAR 内的 node_modules
    const serverPath = path.join(process.resourcesPath, 'mcp-server.mjs');
    console.log(`[McpManager] Packaged mode - bundled server path: ${serverPath}`);
    return {
      command: process.execPath,
      args: [serverPath, localPath],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      } as Record<string, string>,
    };
  } else {
    // 开发模式: 使用 npx
    return {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', localPath],
    };
  }
}

// ============================================
// TypeScript 类型定义
// ============================================

/**
 * 错误码枚举
 */
export type McpErrorCode = 'SPAWN_FAILED' | 'HANDSHAKE_TIMEOUT' | 'SERVER_CRASHED';

/**
 * 自定义错误类型 - MCP 连接错误
 */
export class McpConnectionError extends Error {
  constructor(
    message: string,
    public readonly code: McpErrorCode,
    public readonly retriesLeft: number
  ) {
    super(message);
    this.name = 'McpConnectionError';
    Object.setPrototypeOf(this, McpConnectionError.prototype);
  }

  toString(): string {
    return `[${this.name}] ${this.code}: ${this.message} (剩余重试: ${this.retriesLeft})`;
  }
}

/**
 * 文件条目接口
 */
export interface FileEntry {
  name: string;
  path: string;
  size: number;
  type: 'epub' | 'pdf' | 'txt' | 'md' | 'directory' | 'unknown';
  lastModified: number;
}

/**
 * 连接状态类型
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP 状态接口
 */
export interface McpStatus {
  status: ConnectionStatus;
  currentPath: string | null;
  lastError: Error | null;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 脱敏用户路径 - 隐藏用户名部分以保护隐私
 * 
 * @param filePath - 原始文件路径
 * @returns 脱敏后的路径
 * @example
 * sanitizePath('C:\\Users\\JohnDoe\\Documents\\books') 
 * //=> 'C:\\Users\\***\\Documents\\books'
 */
function sanitizePath(filePath: string): string {
  // Windows: C:\Users\username\... -> C:\Users\***\...
  const windowsPattern = /([A-Z]:\\Users\\)[^\\]+/i;
  if (windowsPattern.test(filePath)) {
    return filePath.replace(windowsPattern, '$1***');
  }

  // macOS/Linux: /Users/username/... -> /Users/***/...
  //             /home/username/... -> /home/***/...
  const unixPattern = /(\/(?:Users|home)\/)[^/]+/;
  if (unixPattern.test(filePath)) {
    return filePath.replace(unixPattern, '$1***');
  }

  return filePath;
}

function getFileTypeFromName(name: string): FileEntry['type'] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.epub')) return 'epub';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.txt')) return 'txt';
  if (lower.endsWith('.md')) return 'md';
  return 'unknown';
}

function getToolErrorMessage(result: unknown): string | null {
  const record = (typeof result === 'object' && result !== null ? result : {}) as Record<string, unknown>;
  if (record.isError !== true) return null;

  const content = Array.isArray(record.content) ? record.content : [];
  const errors: string[] = [];
  for (const item of content) {
    const itemRecord = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    if (itemRecord.type === 'text' && typeof itemRecord.text === 'string' && itemRecord.text.trim()) {
      errors.push(itemRecord.text.trim());
    }
  }
  return errors.length > 0 ? errors.join(' | ') : 'MCP tool returned error';
}

function buildEntryPath(basePath: string, name: string): string {
  return path.join(basePath, name);
}

function parseListDirectoryText(text: string, basePath: string): FileEntry[] {
  const entries: FileEntry[] = [];
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== '---');

  for (const line of lines) {
    if (line.startsWith('[DIR]')) {
      const name = line.replace('[DIR]', '').trim();
      if (!name) continue;
      entries.push({
        name,
        path: buildEntryPath(basePath, name),
        size: 0,
        type: 'directory',
        lastModified: Date.now(),
      });
      continue;
    }
    if (line.startsWith('[FILE]')) {
      const name = line.replace('[FILE]', '').trim();
      if (!name) continue;
      entries.push({
        name,
        path: buildEntryPath(basePath, name),
        size: 0,
        type: getFileTypeFromName(name),
        lastModified: Date.now(),
      });
    }
  }

  return entries;
}

// ============================================
// McpManager 单例类
// ============================================

const RETRY_DELAYS = [2000, 4000, 8000]; // 指数退避: 2s, 4s, 8s
const MAX_RETRIES = 3;

export class McpManager {
  private static instance: McpManager | null = null;

  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private status: ConnectionStatus = 'disconnected';
  private currentPath: string | null = null;
  private lastError: Error | null = null;

  /**
   * 私有构造函数 - 禁止外部直接实例化
   */
  private constructor() {
    // 单例模式: 构造函数私有化
  }

  /**
   * 获取 McpManager 单例实例
   */
  public static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  /**
   * 获取当前连接状态快照
   * @returns 状态对象,包含连接状态、当前路径和最后错误
   */
  public getStatus(): McpStatus {
    return {
      status: this.status,
      currentPath: this.currentPath,
      lastError: this.lastError,
    };
  }

  /**
   * 连接到本地 MCP Filesystem Server
   * 
   * @param localPath - 要挂载的本地目录路径
   * @throws {McpConnectionError} 连接失败时抛出
   * @throws {Error} 参数无效时抛出
   */
  public async connectLocal(localPath: string): Promise<void> {
    // 5.2: 参数验证
    if (!localPath || typeof localPath !== 'string') {
      throw new Error('Invalid path: 路径必须为非空字符串');
    }

    // 规范化路径 (Windows 兼容性)
    const normalizedPath = path.normalize(localPath);

    // 5.3: 如果已连接且路径相同,直接返回
    if (this.status === 'connected' && this.currentPath === normalizedPath) {
      console.log(`[McpManager] Already connected to ${sanitizePath(normalizedPath)}`);
      return;
    }

    // 5.4: 如果已连接但路径不同,先断开
    if (this.status === 'connected' && this.currentPath !== normalizedPath) {
      console.log('[McpManager] Disconnecting from old path before connecting to new path');
      await this.disconnect();
    }

    // 5.5: 更新状态为 'connecting'
    this.status = 'connecting';
    this.currentPath = normalizedPath;
    console.log(`[McpManager] Connecting to local path: ${sanitizePath(normalizedPath)}`);

    // 5.6: 调用带重试逻辑的连接方法
    await this._attemptConnection(normalizedPath);
  }

  /**
   * 使用超时包装 MCP 连接
   *
   * @param timeoutMs - 超时毫秒数,默认 10000 (10秒)
   * @throws {Error} 连接超时或传输层未初始化时抛出
   */
  private async connectWithTimeout(timeoutMs = 10000): Promise<void> {
    if (!this.transport) throw new Error('Transport not initialized');
    return Promise.race([
      this.client!.connect(this.transport),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MCP connection timeout')), timeoutMs)
      )
    ]) as Promise<never>;
  }

  /**
   * 尝试建立 MCP 连接,支持自动重试(私有方法)
   * 
   * @param localPath - 本地目录路径
   * @param retryCount - 当前重试次数 (从 0 开始)
   * @throws {McpConnectionError} 所有重试耗尽后抛出
   */
  private async _attemptConnection(localPath: string, retryCount = 0): Promise<void> {
    try {
      // 6.1: 创建 StdioClientTransport 实例
      const mcpConfig = getMcpServerConfig(localPath);
      this.transport = new StdioClientTransport({
        command: mcpConfig.command,
        args: mcpConfig.args,
        env: mcpConfig.env,
      });

      // 6.2: 创建 Client 实例
      this.client = new Client(
        { name: 'immerseai-client', version: '1.0.0' },
        { capabilities: {} }
      );

      // 6.3: 建立连接 (带 10 秒超时)
      await this.connectWithTimeout();

      // 6.4: 连接成功,更新状态
      this.status = 'connected';
      this.lastError = null;
      console.log(`[McpManager] Successfully connected to ${sanitizePath(localPath)}`);
    } catch (error) {
      // 7.3: 连接失败,检查是否可重试
      if (retryCount < MAX_RETRIES) {
        // 7.4: 记录重试日志
        console.warn(
          `[McpManager] Connection failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`,
          error
        );

        // 清理失败的连接尝试
        this.client = null;
        this.transport = null;

        // 7.5: 等待指数退避时间后递归重试
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[retryCount]));
        return this._attemptConnection(localPath, retryCount + 1);
      } else {
        // 7.6: 重试耗尽,更新状态并抛出错误
        this.status = 'error';
        this.lastError = error instanceof Error ? error : new Error(String(error));

        // 清理失败的连接尝试
        this.client = null;
        this.transport = null;

        // 判断错误类型并抛出相应的 McpConnectionError
        const errorMessage = error instanceof Error ? error.message : String(error);
        let errorCode: McpErrorCode = 'SERVER_CRASHED';

        if (errorMessage.includes('spawn') || errorMessage.includes('ENOENT')) {
          errorCode = 'SPAWN_FAILED';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
          errorCode = 'HANDSHAKE_TIMEOUT';
        }

        throw new McpConnectionError(
          `MCP 连接失败: ${errorMessage}`,
          errorCode,
          0 // retriesLeft = 0
        );
      }
    }
  }

  /**
   * 断开 MCP 连接并清理资源
   * 
   * @throws 不会抛出错误,清理过程中的错误仅记录日志
   */
  public async disconnect(): Promise<void> {
    // 8.2: 如果已断开,直接返回
    if (this.status === 'disconnected') {
      return;
    }

    console.log('[McpManager] Disconnecting...');

    try {
      // 8.3: 关闭 MCP Client
      if (this.client) {
        await this.client.close();
      }
    } catch (error) {
      // 8.7: 捕获清理错误但不阻断
      console.error('[McpManager] Error closing client:', error);
    }

    try {
      // 8.4: 关闭 Transport (确保子进程退出)
      const transport = this.transport as { close?: () => Promise<void> | void } | null
      if (transport?.close) {
        await transport.close()
      }
    } catch (error) {
      console.error('[McpManager] Error closing transport:', error);
    }

    // 8.5: 清空引用
    this.client = null;
    this.transport = null;

    // 8.6: 更新状态
    this.status = 'disconnected';
    this.currentPath = null;

    console.log('[McpManager] Disconnected');
  }

  /**
   * 列出目录内容
   * 
   * @param directoryPath - 目录路径 (相对于挂载点)
   * @returns 文件条目数组
   * @throws {Error} 未连接或 MCP 调用失败时抛出
   */
  public async listFiles(directoryPath: string): Promise<FileEntry[]> {
    // 10.2: 检查连接状态
    if (this.status !== 'connected' || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    // 规范化路径
    const normalizedPath = path.normalize(directoryPath);

    // 10.3: 记录日志
    console.log(`[McpManager] listFiles: ${sanitizePath(normalizedPath)}`);

    try {
      // 10.4: 调用 MCP Tool
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'list_directory',
            arguments: { path: normalizedPath },
          },
        },
        CallToolResultSchema
      );
      const toolError = getToolErrorMessage(result);
      if (toolError) {
        throw new Error(toolError);
      }

      // 10.5: 解析结果
      const entries: FileEntry[] = [];
      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text' && typeof item.text === 'string') {
            // 解析文本内容 (可能是 JSON 或纯文本列表)
            try {
              const parsed = JSON.parse(item.text);
              if (Array.isArray(parsed)) {
                for (const item of parsed) {
                  const entry = this._convertToFileEntry(item);
                  if (entry) entries.push(entry);
                }
              }
            } catch {
              // 解析失败时按纯文本格式解析
              entries.push(...parseListDirectoryText(item.text, normalizedPath));
            }
          }
        }
      }

      // 10.6: 记录完成日志
      console.log(`[McpManager] listFiles completed: ${entries.length} items`);
      return entries;
    } catch (error) {
      // 10.7: 包装 MCP 错误
      throw this._wrapMcpError(error, 'listFiles');
    }
  }

  /**
   * 读取文件内容
   * 
   * @param filePath - 文件路径 (相对于挂载点)
   * @returns 文件内容 (文本文件返回 string, 二进制文件返回 ArrayBuffer)
   * @throws {Error} 未连接或 MCP 调用失败时抛出
   */
  public async readFile(filePath: string): Promise<string | ArrayBuffer> {
    // 11.2: 检查连接状态
    if (this.status !== 'connected' || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    // 规范化路径
    const normalizedPath = path.normalize(filePath);

    // 11.3: 记录日志
    console.log(`[McpManager] readFile: ${sanitizePath(normalizedPath)}`);

    try {
      // 11.4: 调用 MCP Tool
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: { path: normalizedPath },
          },
        },
        CallToolResultSchema
      );
      const toolError = getToolErrorMessage(result);
      if (toolError) {
        throw new Error(toolError);
      }

      // 11.5: 根据返回类型判断
      if (result.content && Array.isArray(result.content) && result.content[0]) {
        const content = result.content[0];
        if (content.type === 'text') {
          return content.text || '';
        } else if (content.type === 'resource') {
          const resource = content.resource;
          // 检查是否为 blob 类型的 resource
          if (resource && 'blob' in resource && typeof resource.blob === 'string') {
            // 二进制内容 (Base64 编码)
            const base64 = resource.blob;
            const buffer = Buffer.from(base64, 'base64');
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
          }
        }
      }

      return '';
    } catch (error) {
      // 11.6: 包装 MCP 错误
      throw this._wrapMcpError(error, 'readFile');
    }
  }

  /**
   * 写入文件内容
   * 
   * @param filePath - 文件路径 (相对于挂载点)
   * @param content - 文件内容
   * @throws {Error} 未连接或 MCP 调用失败时抛出
   */
  public async writeFile(filePath: string, content: string): Promise<void> {
    // 12.2: 检查连接状态
    if (this.status !== 'connected' || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    // 规范化路径
    const normalizedPath = path.normalize(filePath);

    // 12.3: 记录日志
    console.log(`[McpManager] writeFile: ${sanitizePath(normalizedPath)}`);

    try {
      // 12.4: 调用 MCP Tool
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'write_file',
            arguments: { path: normalizedPath, content },
          },
        },
        CallToolResultSchema
      );
      const toolError = getToolErrorMessage(result);
      if (toolError) {
        throw new Error(toolError);
      }

      // 12.5: 操作完成
      console.log(`[McpManager] writeFile completed: ${normalizedPath}`);
    } catch (error) {
      // 12.6: 包装 MCP 错误
      throw this._wrapMcpError(error, 'writeFile');
    }
  }

  /**
   * 移动或重命名文件
   * 
   * @param source - 源文件路径
   * @param destination - 目标文件路径
   * @throws {Error} 未连接或 MCP 调用失败时抛出
   */
  public async moveFile(source: string, destination: string): Promise<void> {
    // 13.2: 检查连接状态
    if (this.status !== 'connected' || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    // 规范化路径
    const normalizedSource = path.normalize(source);
    const normalizedDestination = path.normalize(destination);

    // 13.3: 记录日志
    console.log(`[McpManager] moveFile: ${sanitizePath(normalizedSource)} -> ${sanitizePath(normalizedDestination)}`);

    try {
      // 13.4: 调用 MCP Tool
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'move_file',
            arguments: { source: normalizedSource, destination: normalizedDestination },
          },
        },
        CallToolResultSchema
      );
      const toolError = getToolErrorMessage(result);
      if (toolError) {
        throw new Error(toolError);
      }

      // 13.5: 操作完成
      console.log(`[McpManager] moveFile completed`);
    } catch (error) {
      // 13.6: 包装 MCP 错误
      throw this._wrapMcpError(error, 'moveFile');
    }
  }

  /**
   * 创建目录
   * 
   * @param directoryPath - 目录路径 (相对于挂载点)
   * @throws {Error} 未连接或 MCP 调用失败时抛出
   */
  public async createDirectory(directoryPath: string): Promise<void> {
    // 检查连接状态
    if (this.status !== 'connected' || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    // 规范化路径
    const normalizedPath = path.normalize(directoryPath);

    // 记录日志
    console.log(`[McpManager] createDirectory: ${sanitizePath(normalizedPath)}`);

    try {
      // 调用 MCP Tool
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_directory',
            arguments: { path: normalizedPath },
          },
        },
        CallToolResultSchema
      );
      const toolError = getToolErrorMessage(result);
      if (toolError) {
        throw new Error(toolError);
      }

      // 操作完成
      console.log(`[McpManager] createDirectory completed`);
    } catch (error) {
      // 包装 MCP 错误
      throw this._wrapMcpError(error, 'createDirectory');
    }
  }

  /**
   * 删除文件
   * 
   * @param filePath - 文件路径 (相对于挂载点)
   * @throws {Error} 未连接或 MCP 调用失败时抛出
   */
  public async deleteFile(filePath: string): Promise<void> {
    // 检查连接状态
    if (this.status !== 'connected' || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    // 规范化路径
    const normalizedPath = path.normalize(filePath);

    // 记录日志
    console.log(`[McpManager] deleteFile: ${sanitizePath(normalizedPath)}`);

    try {
      // 兼容不同版本 server-filesystem 的删除工具名
      await this._callDeleteToolWithFallback(normalizedPath);

      // 操作完成
      console.log(`[McpManager] deleteFile completed`);
    } catch (error) {
      // 包装 MCP 错误
      throw this._wrapMcpError(error, 'deleteFile');
    }
  }

  // ============================================
  // 私有辅助方法
  // ============================================

  /**
   * 包装 MCP 错误为用户友好的错误消息
   */
  private _wrapMcpError(error: unknown, operation: string): Error {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 错误消息转换
    if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
      if (operation === 'listFiles') {
        return new Error('Directory not found: 目录不存在');
      } else if (operation === 'readFile') {
        return new Error('File not found: 文件不存在');
      } else if (operation === 'moveFile') {
        return new Error('Source file not found: 源文件不存在');
      } else if (operation === 'deleteFile') {
        return new Error('File not found: 要删除的文件不存在');
      } else if (operation === 'createDirectory') {
        return new Error('Parent directory not found: 父目录不存在');
      }
    }

    if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
      return new Error('Permission denied: 没有访问权限');
    }

    if (errorMessage.includes('exists') || errorMessage.includes('EEXIST')) {
      if (operation === 'createDirectory') {
        return new Error('Directory already exists: 目录已存在');
      }
      return new Error('Destination exists: 目标文件已存在');
    }

    if (errorMessage.includes('too large')) {
      return new Error('File too large: 文件过大,无法读取');
    }

    if (errorMessage.includes('not empty') || errorMessage.includes('ENOTEMPTY')) {
      return new Error('Directory not empty: 目录非空,无法删除');
    }

    // 默认错误
    return new Error(`${operation} failed: ${errorMessage}`);
  }

  /**
   * 兼容调用删除工具：
   * - 新旧版本 server-filesystem 的删除工具名不同，按候选列表回退尝试
   */
  private async _callDeleteToolWithFallback(normalizedPath: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to MCP server');
    }

    const dynamicCandidates = await this._getDeleteToolCandidates();
    const staticCandidates = ['delete_file', 'delete_path', 'remove_file', 'remove_path', 'delete_directory', 'delete'];
    const candidates = [...new Set([...dynamicCandidates, ...staticCandidates])];
    const argCandidates: Array<Record<string, unknown>> = [
      { path: normalizedPath },
      { target: normalizedPath },
      { filePath: normalizedPath },
      { directoryPath: normalizedPath },
      { paths: [normalizedPath] },
    ];
    let lastError: Error | null = null;

    for (const toolName of candidates) {
      for (const args of argCandidates) {
        try {
          const result = await this.client.request(
            {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: args,
              },
            },
            CallToolResultSchema,
          );
          const toolError = getToolErrorMessage(result);
          if (toolError) {
            throw new Error(toolError);
          }
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('Unknown tool')) {
            lastError = error instanceof Error ? error : new Error(message);
            break; // 换下一个 toolName
          }
          if (
            message.includes('Invalid arguments') ||
            message.includes('required property') ||
            message.includes('Expected object') ||
            message.includes('Schema')
          ) {
            lastError = error instanceof Error ? error : new Error(message);
            continue; // 同一 toolName 尝试下一种参数结构
          }
          throw error;
        }
      }
    }

    // 当前 MCP Server 不支持删除工具时，降级到本地文件系统删除（仅限挂载目录内）
    if (lastError && (lastError.message.includes('Unknown tool') || lastError.message.includes('No supported delete tool found'))) {
      await this._deleteWithNativeFsFallback(normalizedPath);
      return;
    }

    throw lastError ?? new Error('No supported delete tool found');
  }

  private async _getDeleteToolCandidates(): Promise<string[]> {
    if (!this.client) return [];

    try {
      const result = await this.client.request({ method: 'tools/list' }, ListToolsResultSchema);
      const tools = Array.isArray(result.tools) ? result.tools : [];
      const names = tools
        .map((tool) => (tool && typeof tool.name === 'string' ? tool.name : ''))
        .filter((name) => name.length > 0);

      if (names.length > 0) {
        console.log(`[McpManager] available tools: ${names.join(', ')}`);
      }
      const deleteLikeNames = names.filter((name) => /delete|remove/i.test(name));
      if (deleteLikeNames.length > 0) {
        console.log(`[McpManager] delete tool candidates: ${deleteLikeNames.join(', ')}`);
      }
      return deleteLikeNames;
    } catch (error) {
      console.warn('[McpManager] Failed to list tools before delete fallback:', error);
      return [];
    }
  }

  /**
   * 本地删除兜底：仅允许删除当前挂载根目录内的路径
   */
  private async _deleteWithNativeFsFallback(targetPath: string): Promise<void> {
    if (!this.currentPath) {
      throw new Error('deleteFile fallback failed: currentPath is empty');
    }

    const root = path.resolve(this.currentPath);
    const resolvedTarget = path.resolve(targetPath);
    const relative = path.relative(root, resolvedTarget);
    const isInsideRoot = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);

    if (!isInsideRoot) {
      throw new Error('deleteFile fallback denied: target path is outside mounted root');
    }

    await fs.rm(resolvedTarget, { recursive: true, force: false });
    console.log(`[McpManager] deleteFile fallback completed via fs.rm: ${sanitizePath(resolvedTarget)}`);
  }

  /**
   * 转换 MCP 返回的文件条目为 FileEntry 格式
   */
  private _convertToFileEntry(item: unknown): FileEntry | null {
    const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;

    const name = typeof record.name === 'string' ? record.name : '';
    const recordType = typeof record.type === 'string' ? record.type : 'file';
    if (!name) return null;

    return {
      name,
      path: typeof record.path === 'string' ? record.path : '',
      size: typeof record.size === 'number' ? record.size : 0,
      type: recordType === 'directory' ? 'directory' : getFileTypeFromName(name),
      lastModified: typeof record.lastModified === 'number' ? record.lastModified : Date.now(),
    };
  }
}
