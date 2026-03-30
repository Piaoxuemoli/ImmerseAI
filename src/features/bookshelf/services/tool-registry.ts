/**
 * Tool 注册表 - 单一实例
 *
 * 负责：
 * - 管理所有可用的 Tool 定义
 * - 提供 Tool 调用执行能力
 * - 导出 OpenAI function calling 格式的 schema
 */

import type { ToolCall, ToolCallResult } from '@/shared/types'
import { normalizeParams } from './tool-definitions'

/**
 * Tool 定义
 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  execute: (params: Record<string, unknown>) => Promise<ToolCallResult>
}

/**
 * Tool 注册表 - 单一实例
 */
export class ToolRegistry {
  private static instance: ToolRegistry | null = null
  private tools = new Map<string, ToolDefinition>()

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry()
    }
    return ToolRegistry.instance
  }

  /**
   * 注册 Tool
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * 获取 Tool
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * 获取所有 Tool
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /**
   * 执行 Tool 调用
   */
  async execute(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return {
        tool: toolName,
        args,
        result: null,
        success: false,
        isFinal: false,
        error: `Tool not found: ${toolName}`,
      }
    }

    // 标准化参数（处理别名问题）
    const normalizedArgs = normalizeParams(toolName, args)

    try {
      const result = await tool.execute(normalizedArgs)
      return result
    } catch (error) {
      return {
        tool: toolName,
        args: normalizedArgs,
        result: null,
        success: false,
        isFinal: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * 批量执行 Tool 调用
   */
  async executeAll(calls: ToolCall[]): Promise<ToolCallResult[]> {
    return Promise.all(calls.map((call) => this.execute(call.tool, call.args)))
  }

  /**
   * 导出给 LLM 的 tool schema 列表（OpenAI function calling 格式）
   */
  getSchemas(): object[] {
    return this.getAll().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }
}
