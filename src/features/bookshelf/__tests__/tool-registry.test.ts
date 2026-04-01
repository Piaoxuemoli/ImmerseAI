import { describe, it, expect } from 'vitest'
import { ToolRegistry } from '../services/tool-registry'

describe('ToolRegistry', () => {
  it('should register and retrieve tools', () => {
    const registry = ToolRegistry.getInstance()
    const tool = {
      name: 'test_tool',
      description: 'test',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => ({ tool: 'test_tool', args: {}, result: 'ok', success: true, isFinal: true })
    }
    registry.register(tool)
    expect(registry.get('test_tool')).toBeDefined()
    expect(registry.getAll()).toContain(tool)
  })

  it('should return schemas for LLM', () => {
    const registry = ToolRegistry.getInstance()
    const schemas = registry.getSchemas()
    expect(Array.isArray(schemas)).toBe(true)
  })
})