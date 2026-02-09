## MODIFIED Requirements

### Requirement: ImmerseStore 接口定义
系统 SHALL 创建全局 Zustand store，严格实现 ImmerseStore 接口（宪法第五章 5.2 节），并包含 LLM 配置与书架路径字段。

#### Scenario: Store 结构完整性
- **WHEN** 创建 src/shared/store/index.ts
- **THEN** 必须包含所有必需的 state 字段：books, selectedBookId, connectionStatus, currentCfi, readerMode, personas, activePersonaId, currentSession, isGenerating, indexingProgress, llmConfig, bookshelfRootPath
- **AND** 所有字段类型必须与 ImmerseStore 接口定义完全一致

#### Scenario: Actions 定义
- **WHEN** 定义 store actions
- **THEN** 必须包含所有基础 actions：setBooks, selectBook, addMessage, setPersona, toggleMode, setLlmConfig, setBookshelfRootPath
- **AND** 每个 action 必须有明确的 TypeScript 类型签名

#### Scenario: 类型导入
- **WHEN** 定义 ImmerseStore 接口
- **THEN** 必须从 @/shared/types 导入所有领域类型（Book, Persona, ChatSession, Message, LlmConfig）
- **AND** 禁止使用 `any` 或 `unknown` 类型

### Requirement: 选择性持久化配置
系统 SHALL 使用 zustand/middleware 的 persist 插件实现选择性数据持久化，包含 LLM 配置。

#### Scenario: 持久化字段
- **WHEN** 配置 persist 中间件
- **THEN** 必须将 books, personas, currentSession, llmConfig, bookshelfRootPath 持久化到 localStorage
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
- **AND** 对象包含 books, personas, currentSession, llmConfig, bookshelfRootPath 五个字段

#### Scenario: localStorage 读取
- **WHEN** 应用启动时
- **THEN** 自动从 localStorage 读取 'immerse-store' key
- **AND** 恢复 books, personas, currentSession, llmConfig, bookshelfRootPath 到 store 初始状态
- **AND** 如果 localStorage 中无数据，使用默认初始值
