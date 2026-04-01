/**
 * Skill 定义 - 从 MD 文件解析
 */
export interface Skill {
  name: string                    // kebab-case, 如 'move-books-between-folders'
  description: string             // 泛型描述，如"将文件夹 X 中的所有书籍移动到文件夹 Y"
  适用条件: string[]               // Agent 判断是否命中的条件列表
  paramTemplate: Record<string, { type: string; description: string }>  // 参数模板
  steps: SkillStep[]             // 执行步骤（模板形式）
  constraints: string[]          // 约束条件
}

/**
 * Skill 执行步骤
 */
export interface SkillStep {
  tool: string                   // 工具名，如 'move_file'
  description: string             // 步骤描述
  params: Record<string, string> // 参数模板，key 为参数名，value 为来源
}

/**
 * Skill 目录索引
 */
export interface SkillCatalog {
  version: number
  skills: string[]  // Skill 名称列表
}
