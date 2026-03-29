import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SkillManager } from '../services/skill-manager'

// Mock Electron app module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/mock/userData'
      return '/mock'
    })
  }
}))

describe('SkillManager', () => {
  beforeEach(() => {
    // Reset singleton instance between tests
    // @ts-expect-error accessing private static property for testing
    SkillManager.instance = null
  })

  it('should parse skill markdown', () => {
    const manager = SkillManager.getInstance()
    const markdown = `---
name: test-skill
description: 这是一个测试 Skill
---

## 适用条件
- 用户说"测试"

## 参数模板
- source (string): 源路径

## 约束
- 只读
`
    const skill = manager.parseSkillMarkdown(markdown, 'test-skill')
    expect(skill.name).toBe('test-skill')
    expect(skill.paramTemplate.source).toBeDefined()
  })
})