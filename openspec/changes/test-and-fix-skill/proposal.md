## Why

项目已完成约 65-70% 的功能实现，但缺乏系统化的测试与修复流程。当前测试依赖开发者手动检查代码，没有可复用的自动化测试方案，也没有标准化的人工测试报告流程。需要一个 Copilot Skill 让 Agent 能够：
1. **自动化测试**：Agent 自主执行代码检查/编译验证/结构审计，发现问题后立即修复，形成闭环。
2. **人工测试修复**：人类完成体验测试后提交报告，Agent 解析报告中的失败项并自动修复。

## What Changes

- 新建 `.github/skills/test-and-fix/` Skill 目录，包含 `SKILL.md` 指令文件
- 新建 `docs/test-classification.md` 作为测试定义文件（已存在，需规范化为 Skill 可引用的格式）
- Skill 支持两种模式触发：
  - **自动化模式** (`自动化测试` / `auto test`)：Agent 按预定义的 AT-01~AT-14 测试项逐条执行检查、产出 PASS/FAIL 结论、FAIL 时自动修复并重验
  - **人工报告模式** (`人工测试` / `manual test`)：Agent 接收人类填写的测试报告表格，解析所有 ❌ 标记项，逐个分析原因并实施代码修复
- 两种模式共享相同的修复闭环：修复 → TypeScript 编译验证 → 报告结果

## Capabilities

### New Capabilities
- `test-and-fix-skill`: Agent Skill 定义，包含自动化测试执行引擎和人工报告解析修复引擎的完整指令

### Modified Capabilities
_无需修改现有 spec 的行为要求_

## Impact

- **新文件**: `.github/skills/test-and-fix/SKILL.md`
- **引用文件**: `docs/test-classification.md`（作为测试定义的数据源）
- **触发方式**: 用户在 Copilot Chat 中输入"自动化测试"、"人工测试"等关键词时激活
- **依赖**: 项目已有的 TypeScript 编译配置、Zustand Store、IPC 通道、RAG Worker 等基础设施
