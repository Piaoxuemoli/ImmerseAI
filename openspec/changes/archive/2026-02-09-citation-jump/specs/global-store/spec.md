## MODIFIED Requirements

### Requirement: ImmerseStore 接口定义
系统 SHALL 创建全局 Zustand store，严格实现 ImmerseStore 接口（宪法第五章 5.2 节），并包含 LLM 配置、书架路径及引用跳转信号字段。

#### Scenario: Store 结构完整性
- **WHEN** 创建 src/shared/store/index.ts
- **THEN** 必须包含所有必需的 state 字段：books, selectedBookId, connectionStatus, currentCfi, readerMode, personas, activePersonaId, currentSession, isGenerating, indexingProgress, llmConfig, bookshelfRootPath, pendingCitationCfi
- **AND** 所有字段类型必须与 ImmerseStore 接口定义完全一致

#### Scenario: Actions 定义
- **WHEN** 定义 store actions
- **THEN** 必须包含所有基础 actions：setBooks, selectBook, addMessage, setPersona, toggleMode, setLlmConfig, setBookshelfRootPath, setPendingCitationCfi
- **AND** 每个 action 必须有明确的 TypeScript 类型签名

#### Scenario: 类型导入
- **WHEN** 定义 ImmerseStore 接口
- **THEN** 必须从 @/shared/types 导入所有领域类型（Book, Persona, ChatSession, Message, LlmConfig）
- **AND** 禁止使用 `any` 或 `unknown` 类型

### Requirement: 初始状态定义
系统 SHALL 为所有 state 字段提供明确的初始值。

#### Scenario: 引用跳转状态初始值
- **WHEN** store 初始化
- **THEN** pendingCitationCfi 初始值为 null

#### Scenario: 非持久化字段
- **WHEN** 应用重启或刷新
- **THEN** pendingCitationCfi 必须重置为 null（不持久化）
