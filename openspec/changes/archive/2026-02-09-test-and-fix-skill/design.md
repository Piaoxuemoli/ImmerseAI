## Context

ImmerseAI 项目处于多 Phase 并行开发阶段（总进度 ~65-70%），各模块代码由 AI Agent 生成，缺乏统一测试与质量闭环。现有测试定义文档 `docs/test-classification.md` 已将测试分为两类：

1. **自动化测试 (AT-01~AT-14)**：Agent 可自主执行的代码审计/编译检查/结构验证，发现问题后自动修复
2. **人工测试 (HT-01~HT-10)**：需人类操作应用并感受 UI/交互，完成后提交测试报告给 Agent 修复

本 Skill 需要以 `.github/skills/test-and-fix/SKILL.md` 的形式存在，被 Copilot 识别为可触发的能力。

## Goals / Non-Goals

**Goals:**
- 创建一个 Copilot Skill，用户输入"自动化测试"/"人工测试"等关键词即可触发
- 自动化模式：Agent 逐条执行 AT 测试项，产出 PASS/FAIL，FAIL 时自动修复并重验
- 人工报告模式：Agent 解析用户提交的测试报告，提取 ❌ 项并逐个修复
- 两种模式共享修复闭环：修复 → TypeScript 编译验证 → 产出修复摘要

**Non-Goals:**
- 不引入测试框架（Jest/Vitest），这不是单元测试，是架构级代码审计 + 体验测试
- 不自动执行人工测试项（UI 交互/动画效果/视觉风格必须人类判断）
- 不修改 `docs/test-classification.md` 的内容结构，Skill 仅引用它作为数据源

## Decisions

### D1: Skill 作为单文件 SKILL.md 实现

**选择**: 将完整逻辑写入 `.github/skills/test-and-fix/SKILL.md`，无需额外脚本或配置文件。

**理由**: 与现有 openspec-* skills 保持一致的模式；Copilot Skills 通过 SKILL.md frontmatter 的 `description` 字段做关键词匹配触发，无需外部依赖。

**替代方案**: 写成 `.github/prompts/` 下的 prompt 文件 — 但 prompt 不支持 frontmatter 描述和自动发现，触发不如 Skill 方便。

### D2: 测试定义数据源策略

**选择**: Skill 内嵌完整的自动化测试执行逻辑（每条测试的步骤、预期、修复策略），引用 `docs/test-classification.md` 作为人工测试的表格模板。

**理由**: 自动化测试的步骤需要精确的命令和预期结果，写在 Skill 中确保 Agent 按步骤执行；人工测试表格仅作为报告格式参考，不需要硬编码到 Skill 中。

### D3: 双模式路由设计

**选择**: Skill 入口根据用户输入/选择分流到"自动化测试流程"或"人工报告修复流程"。

**自动化流程**: 执行步骤 → 判定 PASS/FAIL → FAIL 自动修复 → 重验 → 产出报告
**人工报告流程**: 接收报告 → 解析 ❌ 项 → 逐项分析 → 修复 → 编译验证 → 产出修复摘要

### D4: 修复后必须通过编译门禁

**选择**: 每轮修复后运行 `npx electron-vite build` 作为编译验证门禁，确保修复不引入新错误。

**理由**: 分散修复可能引入类型不一致，统一的编译检查是最低成本的质量保障。

## Risks / Trade-offs

- **[Risk] 自动化测试 AT-06/07/08/12 涉及大量代码修改** → Mitigation: Skill 中给出精确的修复步骤，Agent 按步骤执行而非自行发挥
- **[Risk] 人工报告格式不规范导致解析失败** → Mitigation: Skill 中定义宽松的解析规则（支持 ❌/FAIL/失败 等多种标记）
- **[Risk] 修复一个 AT 可能影响另一个 AT 的预期** → Mitigation: 建议按编号顺序执行，依赖关系已在测试编号中隐含
