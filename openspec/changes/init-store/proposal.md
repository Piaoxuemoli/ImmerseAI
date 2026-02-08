## Why

应用当前缺少全局状态管理，导致书架、阅读器、对话、角色等功能模块的状态分散且难以协调。需要建立统一的状态层以实现跨组件数据共享、状态同步和关键数据的持久化存储。

## What Changes

- 创建 `src/shared/store/index.ts` 作为全局 Zustand store
- 实现 ImmerseStore 接口（严格遵循宪法第五章 5.2 节定义）
- 集成 `zustand/middleware` 的 persist 插件
- 配置选择性持久化策略：
  - **持久化到 localStorage**: books, personas, currentSession（关键业务数据）
  - **仅运行时**: indexingProgress, isGenerating, connectionStatus（临时状态）
- 定义类型安全的 state 结构和 actions

## Capabilities

### New Capabilities

- `global-store`: 全局状态管理 store，包含书籍列表、角色配置、对话会话、阅读进度等核心状态，以及对应的 actions（如 setBooks、selectBook、addMessage、setPersona 等）

### Modified Capabilities

<!-- 此 change 不修改现有 capability 的 requirements -->

## Impact

- **新增依赖**: zustand (^4.5.0), zustand/middleware
- **新增文件**: `src/shared/store/index.ts`
- **影响范围**: 所有需要访问全局状态的 React 组件（Bookshelf、Reader、Chat、Persona 等功能模块）
- **localStorage 占用**: books、personas、currentSession 数据将持久化存储
- **类型系统**: store 类型定义将被 re-exported 供组件导入使用
