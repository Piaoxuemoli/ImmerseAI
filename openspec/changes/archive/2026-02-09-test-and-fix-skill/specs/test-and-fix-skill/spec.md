## ADDED Requirements

### Requirement: Skill 文件结构
系统 SHALL 在 `.github/skills/test-and-fix/` 目录下创建 `SKILL.md` 文件，遵循现有 openspec-* skills 的 frontmatter 格式。

#### Scenario: Skill 可被发现
- **WHEN** 用户在 VS Code 中查看 `.github/skills/` 目录
- **THEN** 存在 `test-and-fix/SKILL.md` 文件，包含有效的 YAML frontmatter（name, description, license, metadata）

#### Scenario: Skill 通过关键词触发
- **WHEN** 用户输入包含"自动化测试"、"自动测试"、"auto test"、"人工测试"、"manual test"、"测试报告"、"test report"等关键词的消息
- **THEN** Copilot 识别并激活 test-and-fix Skill

### Requirement: 模式路由
Skill SHALL 支持两种工作模式：自动化测试模式和人工报告修复模式，根据用户输入或显式选择进行路由。

#### Scenario: 自动选择自动化模式
- **WHEN** 用户输入包含"自动化测试"或"auto test"的消息
- **THEN** Skill 直接进入自动化测试流程，无需额外确认

#### Scenario: 自动选择人工报告模式
- **WHEN** 用户输入包含"人工测试"或"测试报告"的消息，且附带了测试报告内容（包含表格或 ❌ 标记）
- **THEN** Skill 直接进入人工报告修复流程

#### Scenario: 模糊输入时请求选择
- **WHEN** 用户输入仅为"测试"或"test"等模糊词
- **THEN** Skill 使用 AskUserQuestion 工具提供两个选项让用户选择模式

### Requirement: 自动化测试执行引擎
Skill SHALL 按预定义的自动化测试项（AT-01 到 AT-14）逐条执行代码检查，产出 PASS/FAIL 结论，并在 FAIL 时自动修复。

#### Scenario: 执行完整自动化测试套件
- **WHEN** 用户触发自动化测试模式且未指定特定测试项
- **THEN** Agent 从 AT-01 开始按顺序逐条执行所有测试项，每条产出 PASS/FAIL 结论

#### Scenario: 执行指定测试项
- **WHEN** 用户指定特定测试编号（如"运行 AT-06"）
- **THEN** Agent 仅执行指定的测试项

#### Scenario: 测试通过
- **WHEN** 某测试项的所有检查步骤均符合预期
- **THEN** Agent 标记该项为 PASS 并继续下一项

#### Scenario: 测试失败并自动修复
- **WHEN** 某测试项检查发现不符合预期
- **THEN** Agent 按该测试项预定义的"结果处理"修复策略实施代码修改，修复后重新运行该测试项验证直到 PASS

#### Scenario: 修复后编译门禁
- **WHEN** Agent 完成一轮修复
- **THEN** 运行 `npx electron-vite build` 验证编译通过，如有新错误则继续修复

### Requirement: 人工报告解析修复引擎
Skill SHALL 接收人类填写的测试报告，解析失败项，并逐个实施代码修复。

#### Scenario: 解析标准格式报告
- **WHEN** 用户提交包含 Markdown 表格的测试报告，表格中有"状态"列标记为 ❌
- **THEN** Agent 提取所有 ❌ 标记的行，包括测试编号、测试项名称、预期结果和实际结果

#### Scenario: 解析宽松格式标记
- **WHEN** 用户在状态列使用 ❌、FAIL、失败、✗、×、NO 等标记
- **THEN** Agent 均识别为失败项

#### Scenario: 逐项分析并修复
- **WHEN** Agent 提取到 N 个失败项
- **THEN** Agent 逐个分析失败原因，使用 manage_todo_list 跟踪进度，实施代码修复

#### Scenario: 修复闭环验证
- **WHEN** 所有失败项修复完成
- **THEN** 运行 TypeScript 编译检查验证无新错误，产出修复摘要（含修复项列表、变更文件、剩余风险）

### Requirement: 测试结果报告
Skill SHALL 在测试/修复完成后产出结构化的结果报告。

#### Scenario: 自动化测试报告
- **WHEN** 自动化测试套件执行完毕
- **THEN** 产出包含以下内容的报告：测试总数、通过数、失败数、已修复数、修复涉及的文件列表

#### Scenario: 人工修复报告
- **WHEN** 人工报告的失败项全部修复完毕
- **THEN** 产出包含以下内容的报告：原始失败项数、已修复项数、每项的修复摘要、编译验证结果
