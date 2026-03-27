## 1. Skill 文件创建

- [x] 1.1 创建 `.github/skills/qoobee-t&f-skill/SKILL.md` 文件，包含完整的 YAML frontmatter（name: qoobee-t&f-skill, description 含触发关键词列表）
- [x] 1.2 编写 Skill 入口逻辑：模式路由（自动化/人工报告/模糊输入时 AskUserQuestion 选择）
- [x] 1.3 编写自动化测试执行引擎指令：定义 AT-01~AT-14 的逐条执行流程（读取 docs/test-classification.md → 按编号顺序执行 → PASS/FAIL 判定 → FAIL 自动修复 → 重验）
- [x] 1.4 编写人工报告解析修复引擎指令：定义报告接收 → 解析 ❌ 标记行 → 逐项分析原因 → 实施代码修复 → 编译验证闭环
- [x] 1.5 编写修复闭环与结果报告输出格式（自动化报告模板 + 人工修复报告模板）

## 2. 验证与集成

- [x] 2.1 验证 SKILL.md 的 frontmatter 格式正确（与现有 openspec-* skills 一致）
- [x] 2.2 验证 `docs/test-classification.md` 作为数据源可被 Skill 正确引用（检查文件路径和格式）
