## Requirements

### Requirement: ImmerseStore 接口定义
系统 SHALL 创建全局 Zustand store，严格实现 ImmerseStore 接口（宪法第五章 5.2 节）。

#### Scenario: Store 结构完整性
- **WHEN** 创建 src/shared/store/index.ts
- **THEN** 必须包含所有必需的 state 字段：books, selectedBookId, connectionStatus, currentCfi, readerMode, personas, activePersonaId, currentSession, isGenerating, indexingProgress
- **AND** 所有字段类型必须与 ImmerseStore 接口定义完全一致

#### Scenario: Actions 定义
- **WHEN** 定义 store actions
- **THEN** 必须包含所有基础 actions：setBooks, selectBook, addMessage, setPersona, toggleMode
- **AND** 每个 action 必须有明确的 TypeScript 类型签名

#### Scenario: 类型导入
- **WHEN** 定义 ImmerseStore 接口
- **THEN** 必须从 @/shared/types 导入所有领域类型（Book, Persona, ChatSession, Message）
- **AND** 禁止使用 `any` 或 `unknown` 类型

### Requirement: 选择性持久化配置
系统 SHALL 使用 zustand/middleware 的 persist 插件实现选择性数据持久化。

#### Scenario: 持久化字段
- **WHEN** 配置 persist 中间件
- **THEN** 必须将 books, personas, currentSession 持久化到 localStorage
- **AND** storage key 必须为 'immerse-store'

#### Scenario: 非持久化字段
- **WHEN** 应用重启或刷新
- **THEN** indexingProgress, isGenerating, connectionStatus 必须重置为初始值
- **AND** indexingProgress 初始值为空对象 {}
- **AND** isGenerating 初始值为 false
- **AND** connectionStatus 初始值为 'disconnected'

#### Scenario: partialize 函数
- **WHEN** 定义 persist 配置的 partialize
- **THEN** 必须显式返回需要持久化的字段对象
- **AND** 对象仅包含 books, personas, currentSession 三个字段

#### Scenario: localStorage 读取
- **WHEN** 应用启动时
- **THEN** 自动从 localStorage 读取 'immerse-store' key
- **AND** 恢复 books, personas, currentSession 到 store 初始状态
- **AND** 如果 localStorage 中无数据，使用默认初始值

### Requirement: TypeScript 类型安全
系统 SHALL 确保完整的 TypeScript 类型推导和编译时检查。

#### Scenario: Store 类型定义
- **WHEN** 使用 create<ImmerseStore>() 创建 store
- **THEN** TypeScript 必须能推导出所有 state 和 actions 的类型
- **AND** 组件中使用 useStore 时必须有完整的类型提示

#### Scenario: Action 参数类型
- **WHEN** 实现 action 函数
- **THEN** 参数类型必须从 ImmerseStore 接口推导
- **AND** 不需要为每个 action 单独定义类型（Zustand 自动推导）

#### Scenario: 编译检查
- **WHEN** 运行 npx tsc --noEmit
- **THEN** 必须通过所有类型检查，0 errors
- **AND** 能检测到 ImmerseStore 接口与实现不一致的情况

### Requirement: Selector 性能优化
系统 SHALL 支持 selector 模式，允许组件仅订阅所需的 state slice。

#### Scenario: 单字段订阅
- **WHEN** 组件通过 selector 订阅单个字段（如 `useStore(state => state.books)`）
- **THEN** 仅当该字段值变化时触发组件 re-render
- **AND** 其他字段变化不影响此组件

#### Scenario: 多字段订阅
- **WHEN** 组件订阅多个字段
- **THEN** 支持使用 shallow 比较避免不必要的 re-render
- **AND** 组件代码示例：`useStore((state) => ({ books: state.books, selectedBookId: state.selectedBookId }), shallow)`

#### Scenario: Action 订阅
- **WHEN** 组件只需要 action 不需要 state
- **THEN** 可单独订阅 action（如 `useStore(state => state.setBooks)`）
- **AND** action 函数引用稳定，不会导致 re-render

### Requirement: 状态更新原子性
系统 SHALL 确保所有状态更新通过 actions 执行，保证更新的原子性和可追踪性。

#### Scenario: 通过 Actions 更新
- **WHEN** 组件需要更新状态
- **THEN** 必须调用 store 提供的 action 函数（如 setBooks, selectBook）
- **AND** 禁止直接修改 state 对象

#### Scenario: setState 封装
- **WHEN** action 内部调用 Zustand 的 set 函数
- **THEN** 必须传入新的 state 对象或更新函数
- **AND** 支持部分更新（set 会自动 merge）

#### Scenario: 批量更新
- **WHEN** action 需要同时更新多个字段
- **THEN** 可在一次 set 调用中传入多个字段（如 `set({ books, selectedBookId })`）
- **AND** 仅触发一次 re-render

### Requirement: 初始状态定义
系统 SHALL 为所有 state 字段提供明确的初始值。

#### Scenario: 书架状态初始值
- **WHEN** store 初始化
- **THEN** books 初始值为空数组 []
- **AND** selectedBookId 初始值为 null
- **AND** connectionStatus 初始值为 'disconnected'

#### Scenario: 阅读器状态初始值
- **WHEN** store 初始化
- **THEN** currentCfi 初始值为 null
- **AND** readerMode 初始值为 'read'

#### Scenario: 角色状态初始值
- **WHEN** store 初始化
- **THEN** personas 初始值为空数组 []
- **AND** activePersonaId 初始值为 null

#### Scenario: 对话状态初始值
- **WHEN** store 初始化
- **THEN** currentSession 初始值为 null
- **AND** isGenerating 初始值为 false

#### Scenario: RAG 状态初始值
- **WHEN** store 初始化
- **THEN** indexingProgress 初始值为空对象 {}

### Requirement: Store 导出接口
系统 SHALL 导出 useStore hook 供组件使用。

#### Scenario: Hook 导出
- **WHEN** 从 src/shared/store/index.ts 导出
- **THEN** 必须导出 `export const useStore`
- **AND** useStore 类型为 `UseBoundStore<StoreApi<ImmerseStore>>`

#### Scenario: 组件导入
- **WHEN** React 组件导入 store
- **THEN** 可通过 `import { useStore } from '@/shared/store'` 导入
- **AND** 无需导入 ImmerseStore 类型（自动推导）

#### Scenario: TypeScript Re-export
- **WHEN** 需要在组件中引用 ImmerseStore 类型
- **THEN** 可从 store 模块 re-export（如 `export type { ImmerseStore }`）
- **AND** 或直接从 @/shared/types 导入

### Requirement: 开发调试支持
系统 SHALL 提供开发环境下的调试能力。

#### Scenario: DevTools 集成
- **WHEN** 在开发环境运行应用
- **THEN** store 状态可通过 Zustand DevTools 查看
- **AND** 可追踪每次状态变更的 action 名称

#### Scenario: 状态日志
- **WHEN** 需要调试 store 行为
- **THEN** 可在 action 中添加 console.log 查看状态变化
- **AND** localStorage 数据可在浏览器 DevTools > Application > Local Storage 中查看
