/**
 * Tool 定义集合 - 10 个内置 Tool
 *
 * 每个 Tool 复用 window.electronAPI.mcp.* 调用
 */

import type { ToolCallResult } from '@/shared/types'
import { ToolRegistry } from './tool-registry'

/**
 * 参数名别名映射表
 * 解决 LLM 生成错误参数名的问题
 * 格式: { toolName: { alias: canonicalName } }
 */
const PARAM_ALIASES: Record<string, Record<string, string>> = {
  list_folder_contents: {
    folder_path: 'path',
    folder: 'path',
    dir: 'path',
    directory: 'path',
  },
  get_file_content: {
    file_path: 'path',
    filepath: 'path',
    file: 'path',
  },
  search_files: {
    search_path: 'path',
    dir: 'path',
    directory: 'path',
  },
  get_file_metadata: {
    file_path: 'path',
    filepath: 'path',
    file: 'path',
  },
  create_file: {
    file_path: 'path',
    filepath: 'path',
    file: 'path',
    dest: 'path',
    destination: 'path',
  },
  move_file: {
    src: 'source',
    source_path: 'source',
    file: 'source',
    dest: 'destination',
    destination_path: 'destination',
    target: 'destination',
  },
  delete_file: {
    file_path: 'path',
    filepath: 'path',
    file: 'path',
    folder_path: 'path',
  },
}

/**
 * 标准化参数名：将别名映射为规范名称
 */
export function normalizeParams(
  toolName: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  const aliases = PARAM_ALIASES[toolName]
  if (!aliases) return params

  const result: Record<string, unknown> = { ...params }

  for (const [alias, canonical] of Object.entries(aliases)) {
    if (result[alias] !== undefined && result[canonical] === undefined) {
      result[canonical] = result[alias]
      delete result[alias]
    }
  }

  return result
}

// ============================================
// 路径规范化
// ============================================

/**
 * 规范化路径：将 . 和 .. 解析为真实路径
 * 空路径或 . 返回空字符串（表示根目录）
 */
function normalizePath(p: string): string {
  if (!p || p === '.') return ''
  // 将反斜杠转为正斜杠
  let normalized = p.replace(/\\/g, '/')
  // 移除末尾的 /.
  if (normalized.endsWith('/.')) {
    normalized = normalized.slice(0, -2)
  }
  // 解析 ..（简化版，不处理复杂的 ..）
  while (normalized.includes('/../')) {
    normalized = normalized.replace(/\/\.\.\//, '/')
  }
  // 移除多余的 /
  normalized = normalized.replace(/\/+/g, '/')
  // 如果最后剩下的是空字符串，返回空
  return normalized || ''
}

// ============================================
// Tool 工厂函数
// ============================================

function createListFilesTool() {
  return {
    name: 'list_files',
    description: '列出指定目录下的所有文件和文件夹',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '目录路径（绝对路径或相对于书架根目录）',
        },
      },
      required: [] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        const rawPath = params.path as string | undefined
        const path = normalizePath(rawPath || '')
        const entries = await window.electronAPI.mcp.listFiles(path)
        return {
          tool: 'list_files',
          args: params,
          result: entries,
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'list_files',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function createGetFileContentTool() {
  return {
    name: 'get_file_content',
    description: '读取文本文件的内容（支持 .txt, .md 等文本格式）',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '文件路径（绝对路径）',
        },
      },
      required: ['path'] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        const path = params.path as string
        if (!path) {
          return {
            tool: 'get_file_content',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'Missing required parameter: path',
          }
        }
        const content = await window.electronAPI.mcp.readFile(path)
        const text = typeof content === 'string' ? content : new TextDecoder().decode(content)
        return {
          tool: 'get_file_content',
          args: params,
          result: text,
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'get_file_content',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function createSearchFilesTool() {
  return {
    name: 'search_files',
    description: '在目录中搜索包含关键词的文件',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '要搜索的目录路径',
        },
        keyword: {
          type: 'string',
          description: '搜索关键词',
        },
      },
      required: ['path', 'keyword'] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        const path = params.path as string
        const keyword = params.keyword as string
        if (!path || !keyword) {
          return {
            tool: 'search_files',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'Missing required parameters: path and keyword',
          }
        }
        // 递归列出所有文件并过滤
        const allEntries = await window.electronAPI.mcp.listFiles(path)
        const matched: Array<{ name: string; path: string }> = []
        for (const entry of allEntries) {
          if (entry.type !== 'directory' && entry.name.includes(keyword)) {
            matched.push({ name: entry.name, path: entry.path })
          }
        }
        return {
          tool: 'search_files',
          args: params,
          result: matched,
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'search_files',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function createListFolderContentsTool() {
  return {
    name: 'list_folder_contents',
    description: '列出文件夹内容（仅直接子项，不递归）',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '文件夹路径（绝对路径）',
        },
      },
      required: ['path'] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        // 支持别名：folder_path -> path
        const path = (params.path ?? params.folder_path) as string | undefined
        if (!path) {
          return {
            tool: 'list_folder_contents',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'Missing required parameter: path',
          }
        }
        const entries = await window.electronAPI.mcp.listFiles(path)
        return {
          tool: 'list_folder_contents',
          args: params,
          result: entries,
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'list_folder_contents',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function createCountFolderItemsTool() {
  return {
    name: 'count_folder_items',
    description: '统计文件夹中的项目数量',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '文件夹路径（绝对路径）',
        },
      },
      required: ['path'] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        const path = params.path as string
        if (!path) {
          return {
            tool: 'count_folder_items',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'Missing required parameter: path',
          }
        }
        const entries = await window.electronAPI.mcp.listFiles(path)
        return {
          tool: 'count_folder_items',
          args: params,
          result: {
            total: entries.length,
            files: entries.filter((e) => e.type !== 'directory').length,
            folders: entries.filter((e) => e.type === 'directory').length,
          },
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'count_folder_items',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function createGetFileMetadataTool() {
  return {
    name: 'get_file_metadata',
    description: '获取文件的元数据信息（大小、类型、修改时间）',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '文件路径（绝对路径）',
        },
      },
      required: ['path'] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        const path = params.path as string
        if (!path) {
          return {
            tool: 'get_file_metadata',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'Missing required parameter: path',
          }
        }
        // 先列出父目录来获取文件元数据
        const parentPath = path.substring(0, path.lastIndexOf('/') || path.lastIndexOf('\\'))
        const entries = await window.electronAPI.mcp.listFiles(parentPath || '')
        const fileName = path.replace(/.*[\\/]/, '')
        const entry = entries.find((e) => e.name === fileName)
        if (!entry) {
          return {
            tool: 'get_file_metadata',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'File not found',
          }
        }
        return {
          tool: 'get_file_metadata',
          args: params,
          result: {
            name: entry.name,
            path: entry.path,
            size: entry.size,
            type: entry.type,
            lastModified: entry.lastModified,
          },
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'get_file_metadata',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function createCreateFileTool() {
  return {
    name: 'create_file',
    description: '创建新文件并写入内容',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '文件路径（绝对路径）',
        },
        content: {
          type: 'string',
          description: '文件内容',
        },
      },
      required: ['path', 'content'] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        const path = params.path as string
        const content = params.content as string
        if (!path || content === undefined) {
          return {
            tool: 'create_file',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'Missing required parameters: path and content',
          }
        }
        await window.electronAPI.mcp.writeFile(path, content)
        return {
          tool: 'create_file',
          args: params,
          result: { path, contentLength: content.length },
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'create_file',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function createMoveFileTool() {
  return {
    name: 'move_file',
    description: '移动或重命名文件/文件夹',
    parameters: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          description: '源文件路径（绝对路径）',
        },
        destination: {
          type: 'string',
          description: '目标路径（绝对路径）',
        },
      },
      required: ['source', 'destination'] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        const source = params.source as string
        const destination = params.destination as string
        if (!source || !destination) {
          return {
            tool: 'move_file',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'Missing required parameters: source and destination',
          }
        }
        await window.electronAPI.mcp.moveFile(source, destination)
        return {
          tool: 'move_file',
          args: params,
          result: { source, destination },
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'move_file',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function createCreateDirectoryTool() {
  return {
    name: 'create_directory',
    description: '创建新目录',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '目录路径（绝对路径）',
        },
      },
      required: ['path'] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        const path = params.path as string
        if (!path) {
          return {
            tool: 'create_directory',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'Missing required parameter: path',
          }
        }
        await window.electronAPI.mcp.createDirectory(path)
        return {
          tool: 'create_directory',
          args: params,
          result: { path },
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'create_directory',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function createDeleteFileTool() {
  return {
    name: 'delete_file',
    description: '删除文件或空目录',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '要删除的文件或目录路径（绝对路径）',
        },
      },
      required: ['path'] as string[],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolCallResult> => {
      try {
        const path = params.path as string
        if (!path) {
          return {
            tool: 'delete_file',
            args: params,
            result: null,
            success: false,
            isFinal: true,
            error: 'Missing required parameter: path',
          }
        }
        await window.electronAPI.mcp.deleteFile(path)
        return {
          tool: 'delete_file',
          args: params,
          result: { path },
          success: true,
          isFinal: true,
        }
      } catch (error) {
        return {
          tool: 'delete_file',
          args: params,
          result: null,
          success: false,
          isFinal: true,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

// ============================================
// 注册所有内置 Tools
// ============================================

/**
 * 注册所有内置 Tools 到单例 ToolRegistry
 */
export function registerBuiltinTools(): void {
  const registry = ToolRegistry.getInstance()

  const tools = [
    createListFilesTool(),
    createGetFileContentTool(),
    createSearchFilesTool(),
    createListFolderContentsTool(),
    createCountFolderItemsTool(),
    createGetFileMetadataTool(),
    createCreateFileTool(),
    createMoveFileTool(),
    createCreateDirectoryTool(),
    createDeleteFileTool(),
  ]

  for (const tool of tools) {
    registry.register(tool)
  }

  console.log(`[ToolRegistry] Registered ${tools.length} builtin tools`)
}
