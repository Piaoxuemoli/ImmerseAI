# Git 规范

## 分支策略

```
main          ← 稳定版本，每个 Phase 完成后合并
├── dev       ← 日常开发主分支
│   ├── feat/init-scaffold       ← Phase 1 各 Change
│   ├── feat/mcp-manager         ← Phase 2
│   ├── feat/rag-worker-setup    ← Phase 3
│   └── ...
```

## 提交格式（Conventional Commits）

```
<type>(<scope>): <description>

feat(bookshelf): implement BookGrid component with 2:3 covers
fix(rag): resolve SharedArrayBuffer error in Electron
refactor(mcp): extract McpManager as singleton class
docs(spike): add MCP client connection example
chore(deps): add @orama/orama and persistence plugin
```

## 每个 OpenSpec Change 的 Git 流程

```bash
# 1. 从 dev 创建分支
git checkout dev
git checkout -b feat/<change-id>

# 2. 开发（多次小提交）
git add . && git commit -m "feat(scope): description"

# 3. Change 完成后
git checkout dev
git merge feat/<change-id>

# 4. OpenSpec archive 后删除分支
git branch -d feat/<change-id>
```
