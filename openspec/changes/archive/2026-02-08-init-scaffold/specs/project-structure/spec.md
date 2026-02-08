## ADDED Requirements

### Requirement: Feature-based 目录结构
系统 SHALL 采用 Feature-based 目录结构，按功能模块划分代码。

#### Scenario: 功能模块划分
- WHEN 创建新功能
- THEN 在 src/features/ 下创建独立目录
- AND 目录包含 components/, hooks/, store/, services/ 子目录
- AND 同一功能的所有代码集中在同一模块

#### Scenario: 书架功能结构
- WHEN 实现书架功能
- THEN 创建 src/features/bookshelf/ 目录
- AND 包含 BookshelfPage.tsx（页面入口）
- AND 包含 components/（BookGrid, BookCard, LibrarianBar）
- AND 包含 hooks/（useBookshelf）
- AND 包含 store/（bookshelf-store.ts, Zustand）

### Requirement: Shared 模块规范
系统 SHALL 在 src/shared/ 存放跨 feature 的共享代码。

#### Scenario: UI 组件共享
- WHEN 组件被多个 feature 使用
- THEN 存放在 src/shared/components/
- AND shadcn/ui 组件统一在 src/shared/components/ui/

#### Scenario: 类型定义共享
- WHEN 定义全局类型（Book, Persona, Message 等）
- THEN 统一在 src/shared/types/index.ts
- AND 所有模块引用同一份类型定义

#### Scenario: 工具函数共享
- WHEN 工具函数被多处使用
- THEN 存放在 src/shared/lib/utils.ts
- AND 避免在 feature 内重复实现

### Requirement: 主进程目录规范
系统 SHALL 在 electron/main/ 组织主进程代码。

#### Scenario: 主进程模块划分
- WHEN 主进程代码增多
- THEN 按职责划分文件：
  - index.ts（入口）
  - ipc-handlers.ts（IPC 路由）
  - mcp-manager.ts（MCP 客户端）
  - llm-handler.ts（LLM API 调用）
  - safe-storage.ts（安全存储）

### Requirement: Worker 目录规范
系统 SHALL 在 src/workers/ 存放所有 Web Worker 脚本。

#### Scenario: RAG Worker 组织
- WHEN 实现 RAG 引擎 Worker
- THEN 创建 src/workers/rag.worker.ts（主文件）
- AND 创建 src/workers/rag-types.ts（消息类型定义）
- AND 渲染进程通过 new Worker(new URL('./rag.worker.ts', import.meta.url)) 加载

### Requirement: 配置文件顶层放置
系统 SHALL 在项目根目录放置所有配置文件。

#### Scenario: 配置文件位置
- WHEN 需要配置文件
- THEN 放置在根目录（不创建 config/ 目录）
- AND 文件命名清晰（vite.config.ts, tailwind.config.ts, tsconfig.json）
