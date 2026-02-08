## Why

书架页面 (`BookshelfPage`) 目前是占位组件 ("Coming Soon")，无任何交互能力。作为 Phase 2 的核心界面，它是用户启动应用后的第一个落地页，直接决定首次使用体验。需要实现完整的书架 UI：书籍网格展示、顶部导航栏、底部 Librarian 聊天输入框，为后续 MCP 书架连接和 Agent 对话功能提供视觉骨架。

## What Changes

- **新增** `TopBar` 组件：ImmerseAI logo + Settings/Import/GitHub 图标按钮行
- **新增** `BookGrid` 组件：响应式 CSS Grid，承载 BookCard 集合
- **新增** `BookCard` 组件：2:3 宽高比封面卡片，展示封面色块、书名、作者，hover 缩放效果
- **新增** `LibrarianBar` 组件：固定底部聊天输入框 + 发送按钮
- **重写** `BookshelfPage`：替换占位内容，组装上述子组件为完整页面
- **新增** mock 数据：6 本书的静态数据用于 UI 开发和展示
- **新增** shadcn/ui `Input` 和 `Card` 组件（如尚未安装）

## Capabilities

### New Capabilities
- `bookshelf-ui`: 书架页面的完整 UI 实现，包括 TopBar、BookGrid、BookCard、LibrarianBar 四个子组件的布局、样式和交互行为规范

### Modified Capabilities
（无现有 spec 需求级别变更）

## Impact

- **代码**：`src/features/bookshelf/` 目录下新增 4 个组件文件，重写 `BookshelfPage.tsx`
- **依赖**：可能需要通过 `npx shadcn-ui@latest add input card` 安装新 shadcn/ui 组件
- **UI 层**：遵循 `openspec/specs/ui-design/spec.md` 定义的 Notion 极简风格和 slate 色板
- **路由**：无变更，复用现有 `/bookshelf` 路由
- **状态**：本次仅使用 mock 数据，不涉及 Zustand store 集成（留给后续 change）
