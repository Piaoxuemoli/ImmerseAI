/**
 * SkillManager - Skill 加载/保存/查重管理
 *
 * 职责：
 * - 从 builtin `skills/` 和用户 `$USERDATA/skills/` 加载 Skill
 * - 解析 skill markdown 文件为 Skill 对象
 * - 查重（关键词重叠）
 * - 保存新 skill 到用户目录
 * - 生成 system prompt 补充内容
 */

import type { Skill, SkillStep } from '../types/skill'

// 静态 import.meta.glob 只能在 Vite 环境使用
// 使用 import.meta.glob 动态导入所有 builtin skills
const builtinSkillModules = import.meta.glob('/skills/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/**
 * 从参数字符串解析参数模板
 * 例如: "source: folder1, dest: folder2" -> { source: { type: "string", description: "folder1" }, dest: { type: "string", description: "folder2" } }
 */
function parseParamsString(paramsStr: string): Record<string, { type: string; description: string }> {
  const result: Record<string, { type: string; description: string }> = {}
  const lines = paramsStr.split('\n').filter(line => line.trim())

  for (const line of lines) {
    // 匹配格式: "- paramName: description" 或 "- paramName (type): description"
    const match = line.match(/^-\s*(\w+)\s*(?:\(([^)]+)\))?:\s*(.+)$/)
    if (match) {
      const [, paramName, type, description] = match
      result[paramName] = {
        type: type || 'string',
        description: description.trim()
      }
    }
  }
  return result
}

/**
 * 从 markdown 内容解析 steps
 * 格式: "1. tool_name: description" 或 "1. tool_name(param1=value1, param2=value2): description"
 */
function parseSteps(stepsStr: string): SkillStep[] {
  const steps: SkillStep[] = []
  const lines = stepsStr.split('\n').filter(line => line.trim())

  for (const line of lines) {
    // 匹配步骤格式: "1. tool_name: description" 或 "1. tool_name(param=value): description"
    const match = line.match(/^\d+\.\s*(\w+)(?:\(([^)]+)\))?:\s*(.+)$/)
    if (match) {
      const [, tool, paramsStr, description] = match
      const params: Record<string, string> = {}

      if (paramsStr) {
        // 解析参数如 "source=folder1, dest=folder2"
        const paramPairs = paramsStr.split(',')
        for (const pair of paramPairs) {
          const [key, value] = pair.split('=').map(s => s.trim())
          if (key && value) {
            params[key] = value
          }
        }
      }

      steps.push({ tool, description: description.trim(), params })
    }
  }
  return steps
}

/**
 * SkillManager 单例
 */
export class SkillManager {
  private static instance: SkillManager | null = null
  private skills: Map<string, Skill> = new Map()
  private userSkillsPath: string = ''
  private initialized: boolean = false

  private constructor() {}

  /**
   * 异步初始化路径（必须在使用实例前调用）
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    const userDataPath = await window.electronAPI.app.getUserDataPath()
    this.userSkillsPath = userDataPath.replace(/\\/g, '/') + '/skills'
    this.initialized = true
  }

  public static getInstance(): SkillManager {
    if (!SkillManager.instance) {
      SkillManager.instance = new SkillManager()
    }
    return SkillManager.instance
  }

  /**
   * 加载所有 skills（builtin + user）
   */
  async loadAll(): Promise<void> {
    await this.ensureInitialized()
    this.skills.clear()

    // 1. 加载 builtin skills（通过静态 import.meta.glob）
    await this.loadBuiltinSkills()

    // 2. 加载 user skills（通过 IPC 调用主进程）
    await this.loadUserSkills()
  }

  /**
   * 从 import.meta.glob 加载 builtin skills
   */
  private async loadBuiltinSkills(): Promise<void> {
    for (const [filePath, content] of Object.entries(builtinSkillModules)) {
      try {
        // 从文件路径提取 skill 名称
        // filePath 格式: "/skills/xxx.md"
        const fileName = filePath.split('/').pop()?.replace(/\.md$/, '') || filePath
        const skill = this.parseSkillMarkdown(content, fileName)
        this.skills.set(skill.name, skill)
        console.log(`[SkillManager] Loaded builtin skill: ${skill.name}`)
      } catch (error) {
        console.warn(`[SkillManager] Failed to parse builtin skill ${filePath}:`, error)
      }
    }
  }

  /**
   * 从用户目录加载 skills（通过 IPC）
   */
  private async loadUserSkills(): Promise<void> {
    try {
      const files = await window.electronAPI.skills.list(this.userSkillsPath)
      for (const fileName of files) {
        if (!fileName.endsWith('.md')) continue
        try {
          const filePath = `${this.userSkillsPath}/${fileName}`
          const content = await window.electronAPI.skills.read(filePath)
          const skill = this.parseSkillMarkdown(content, fileName)
          this.skills.set(skill.name, skill)
          console.log(`[SkillManager] Loaded user skill: ${skill.name}`)
        } catch (error) {
          console.warn(`[SkillManager] Failed to parse user skill ${fileName}:`, error)
        }
      }
    } catch (error) {
      // 用户目录可能不存在，忽略错误
      console.log(`[SkillManager] No user skills directory or error: ${error}`)
    }
  }

  /**
   * 获取所有 skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values())
  }

  /**
   * 根据名称获取 skill
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  /**
   * 根据描述查找相似的 skill（用于查重）
   * 使用关键词重叠算法
   */
  findSimilarSkill(skillDescription: string): Skill | undefined {
    const keywords = this.extractKeywords(skillDescription)
    if (keywords.length === 0) return undefined

    let bestMatch: Skill | undefined
    let bestScore = 0

    for (const skill of this.skills.values()) {
      const skillKeywords = this.extractKeywords(skill.description)
      const overlap = keywords.filter(k => skillKeywords.includes(k)).length
      const score = overlap / Math.max(keywords.length, skillKeywords.length)

      if (score > bestScore && score > 0.3) { // 阈值 0.3
        bestScore = score
        bestMatch = skill
      }
    }

    return bestMatch
  }

  /**
   * 从描述中提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单分词：去除停用词，提取有意义的词
    const stopWords = new Set(['的', '了', '和', '与', '或', '将', '所有', '一个', '到', '从', '在', '是', '为', '以', '及', '等', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'of', 'for', 'with', 'on', 'by'])
    const words = text.toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w))
    return [...new Set(words)]
  }

  /**
   * 保存 skill 到用户目录
   */
  async saveSkill(skill: Skill): Promise<void> {
    await this.ensureInitialized()
    const content = this.serializeSkill(skill)
    const fileName = `${skill.name}.md`
    const filePath = `${this.userSkillsPath}/${fileName}`

    await window.electronAPI.skills.write(filePath, content)
    this.skills.set(skill.name, skill)
    console.log(`[SkillManager] Saved skill: ${skill.name}`)
  }

  /**
   * 生成 system prompt 补充内容
   */
  getSystemPromptAddition(): string {
    const skills = this.getAll()
    if (skills.length === 0) return ''

    const lines = ['\n\n## Available Skills\n']
    for (const skill of skills) {
      lines.push(`### ${skill.name}`)
      lines.push(`Description: ${skill.description}`)
      if (skill.适用条件.length > 0) {
        lines.push(`Conditions: ${skill.适用条件.join(', ')}`)
      }
      if (Object.keys(skill.paramTemplate).length > 0) {
        lines.push(`Parameters: ${Object.keys(skill.paramTemplate).join(', ')}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * 解析 skill markdown 内容为 Skill 对象
   * @param content markdown 文件内容
   * @param fallbackName 如果 content 没有 frontmatter，使用此名称
   */
  parseSkillMarkdown(content: string, fallbackName: string): Skill {
    // 解析 frontmatter
    let name = fallbackName
    let description = ''
    const 适用条件: string[] = []
    const paramTemplate: Record<string, { type: string; description: string }> = {}
    const steps: SkillStep[] = []
    const constraints: string[] = []

    // 提取 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/)
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1]
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
      if (nameMatch) name = nameMatch[1].trim()
      if (descMatch) description = descMatch[1].trim()
    }

    // 提取 content 部分（去除 frontmatter）
    const mainContent = frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content

    // 解析各 section
    const lines = mainContent.split('\n')
    let currentSection = ''
    let currentSectionContent: string[] = []

    const flushSection = () => {
      if (!currentSection) return
      const content = currentSectionContent.join('\n').trim()

      switch (currentSection) {
        case '适用条件':
          // 解析条件列表: "- 条件1"
          for (const line of content.split('\n')) {
            const match = line.match(/^-\s*(.+)$/)
            if (match) 适用条件.push(match[1].trim())
          }
          break
        case '参数模板':
          Object.assign(paramTemplate, parseParamsString(content))
          break
        case '约束条件':
          // 解析约束列表: "- 约束1"
          for (const line of content.split('\n')) {
            const match = line.match(/^-\s*(.+)$/)
            if (match) constraints.push(match[1].trim())
          }
          break
        case '步骤':
          steps.push(...parseSteps(content))
          break
      }
      currentSection = ''
      currentSectionContent = []
    }

    for (const line of lines) {
      const trimmed = line.trim()

      // 检测 section header
      if (trimmed.startsWith('## ')) {
        flushSection()
        currentSection = trimmed.slice(3).trim()
        continue
      }

      if (trimmed) {
        currentSectionContent.push(line)
      }
    }
    flushSection()

    // 如果 description 为空，尝试从 content 第一行获取
    if (!description && lines.length > 0) {
      const firstPara = lines.find(l => l.trim() && !l.trim().startsWith('#'))
      if (firstPara) {
        description = firstPara.trim()
      }
    }

    return {
      name,
      description,
      适用条件,
      paramTemplate,
      steps,
      constraints
    }
  }

  /**
   * 将 Skill 对象序列化为 markdown 格式
   */
  serializeSkill(skill: Skill): string {
    const lines: string[] = [
      '---',
      `name: ${skill.name}`,
      `description: ${skill.description}`,
      '---',
      '',
      skill.description,
      ''
    ]

    if (skill.适用条件.length > 0) {
      lines.push('## 适用条件')
      for (const condition of skill.适用条件) {
        lines.push(`- ${condition}`)
      }
      lines.push('')
    }

    if (Object.keys(skill.paramTemplate).length > 0) {
      lines.push('## 参数模板')
      for (const [param, info] of Object.entries(skill.paramTemplate)) {
        lines.push(`- ${param} (${info.type}): ${info.description}`)
      }
      lines.push('')
    }

    if (skill.constraints.length > 0) {
      lines.push('## 约束条件')
      for (const constraint of skill.constraints) {
        lines.push(`- ${constraint}`)
      }
      lines.push('')
    }

    if (skill.steps.length > 0) {
      lines.push('## 步骤')
      for (let i = 0; i < skill.steps.length; i++) {
        const step = skill.steps[i]
        const paramsStr = Object.entries(step.params)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')
        const paramsClause = paramsStr ? `(${paramsStr})` : ''
        lines.push(`${i + 1}. ${step.tool}${paramsClause}: ${step.description}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }
}
