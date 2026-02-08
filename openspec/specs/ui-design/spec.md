# UI 设计规范

## 目的
定义 ImmerseAI 的视觉设计语言和组件规范。

## 需求

### Requirement: 设计语言
UI SHALL 遵循 Notion 极简主义风格。

色板：
- 主文字: slate-900 (#0f172a)
- 次文字: slate-500 (#64748b)
- 背景: white (#ffffff) / slate-50 (#f8fafc)
- 边框: slate-200 (#e2e8f0)
- 强调: slate-800 (#1e293b)
- 错误: red-500
- 成功: green-500

字体: Inter, system-ui, sans-serif
间距: 4px 网格 (p-1, p-2, p-4, p-6, p-8)
圆角: rounded-lg (卡片), rounded-md (按钮)

### Requirement: 书架页布局
书架页 SHALL 包含：
1. TopBar（Logo + 操作按钮）
2. 可滚动的 BookGrid（2:3 宽高比封面卡片）
3. 固定底部的 LibrarianBar（聊天输入）

### Requirement: 阅读页布局
阅读页 SHALL 支持两种模式切换：
- Read Mode: 全屏 EPUB 阅读器
- Chat Mode: ChatGPT 风格对话界面
切换 SHALL 使用 framer-motion 动画过渡。

### Requirement: 组件库
所有 UI 组件 SHALL 基于 shadcn/ui。
图标 SHALL 使用 lucide-react。
动画 SHALL 使用 framer-motion。
