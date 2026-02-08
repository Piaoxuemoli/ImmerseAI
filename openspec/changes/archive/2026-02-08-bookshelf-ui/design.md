## Context

**Current State:**
- `BookshelfPage.tsx` 是一个占位组件，仅显示 "Bookshelf — Coming Soon"
- `src/features/bookshelf/components/` 目录为空
- shadcn/ui 已配置（baseColor: slate），已安装 Button, ScrollArea, Dialog, Avatar
- 尚未安装 Input、Card 组件
- lucide-react 已作为依赖存在
- 设计参考图：`docs/design-reference/书架主页-已加载书籍.png`

**Constraints:**
- 宪法 P-2: UI 零阻塞，纯展示组件无需 Worker
- 宪法禁止 CSS Modules / Styled Components，仅用 TailwindCSS
- 宪法禁止大量使用 `@apply`，直接在 JSX 中写 Tailwind 类
- 本次仅 mock 数据，不接入 Zustand store 或 MCP

**Stakeholders:**
- ReaderPage — 点击 BookCard 后路由跳转到 `/reader/:id`
- 未来的 Bookshelf Store — 本次提供的 mock 数据结构需与 `Book` 接口对齐
- 未来的 LibrarianAgent — LibrarianBar 的 UI 骨架需预留对接空间

## Goals / Non-Goals

**Goals:**
1. 实现完整的书架页面布局：TopBar + BookGrid + BookCard + LibrarianBar
2. 书籍卡片遵循 2:3 宽高比，响应式网格（自适应列数）
3. BookCard hover 缩放动效
4. 底部 LibrarianBar 固定定位，不随内容滚动
5. 使用 6 本 mock 书籍数据展示，数据结构对齐 `Book` 接口
6. 严格遵循 Notion 极简风格和 slate 色板

**Non-Goals:**
1. **不实现** Zustand store 集成（留给后续 bookshelf-store change）
2. **不实现** 真实的文件导入功能（Import 按钮暂为空操作）
3. **不实现** LibrarianBar 的聊天逻辑（仅 UI 骨架）
4. **不实现** 拖拽导入 EPUB 功能
5. **不实现** 空状态 UI（本次使用 mock 数据，始终有书显示）
6. **不实现** BookCard 点击跳转（路由跳转逻辑留给后续 change）

## Decisions

### D1: 组件拆分粒度

**选择:** 4 个独立子组件 + 1 个页面组装组件

```
BookshelfPage.tsx       ← 页面入口，组装布局
├── TopBar.tsx          ← 顶部导航栏
├── BookGrid.tsx        ← 网格容器（接收 books 数组）
│   └── BookCard.tsx    ← 单本书卡片（纯展示）
└── LibrarianBar.tsx    ← 底部聊天输入
```

**理由:**
- 每个组件职责单一，便于独立测试和复用
- BookGrid 和 BookCard 分离，BookGrid 负责布局，BookCard 负责单卡渲染
- 与宪法第六章 6.2 节的组件结构定义一致

**替代方案:**
- 全部写在 BookshelfPage 中 — 文件过大，违反 SRP
- 更细粒度拆分（如 BookCover 独立组件）— 过度拆分，当前无复用需求

### D2: 响应式网格策略

**选择:** CSS Grid + `auto-fill` + `minmax`

```tsx
// 自适应列数：最小 160px，自动填满
className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6"
```

**理由:**
- `auto-fill` + `minmax` 天然响应式，无需手写断点
- 最小 160px 保证封面可读性，最大 1fr 均匀分布
- 参考设计图：1440px 宽度下约 5-6 列

**替代方案:**
- 固定列数断点 (`grid-cols-3 md:grid-cols-4 lg:grid-cols-5`) — 更可预测，但灵活性差
- Flexbox wrap — 尾行对齐问题难处理

### D3: BookCard 封面实现方式

**选择:** 纯色背景色块 + 白色书名文字

**实现:**
```tsx
// 每本书分配一个 muted 封面色
const COVER_COLORS = [
  'bg-slate-700', 'bg-red-900', 'bg-emerald-800',
  'bg-amber-800', 'bg-sky-900', 'bg-violet-900'
];
```

**理由:**
- Mock 阶段无真实封面图，色块是最简洁的占位方案
- 与设计参考图一致（"use muted tones like deep navy, burgundy, forest green"）
- 未来对接真实数据后，优先显示 `coverUrl`，fallback 到色块

**替代方案:**
- placeholder 图片 — 需额外静态资源管理
- 渐变色 — 违反宪法"Notion 极简风格，无渐变"

### D4: 2:3 宽高比实现

**选择:** `aspect-[2/3]` Tailwind 工具类

**理由:**
- Tailwind v3+ 原生支持 `aspect-ratio`
- 语义清晰，无需 padding-top hack
- 所有现代浏览器（Electron 28+ Chromium）均支持

**替代方案:**
- `padding-top: 150%` hack — 旧方案，语义差
- 固定 width/height — 不响应式

### D5: LibrarianBar 定位策略

**选择:** 固定底部 + 页面 padding-bottom 预留空间

```tsx
// LibrarianBar: 固定定位
className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/80 backdrop-blur-sm"

// BookshelfPage 主内容区: 底部预留 LibrarianBar 高度
className="pb-20" // ~80px
```

**理由:**
- `fixed` 定位确保 LibrarianBar 始终可见
- `backdrop-blur-sm` 给底栏微妙的毛玻璃效果，与设计参考图的 "glass-morphism-like" 一致
- 主内容区 `pb-20` 防止内容被遮挡

**替代方案:**
- Flexbox `flex-col` 布局 — 需要精确计算高度，且 scroll 区域需额外处理
- `sticky` 定位 — 在嵌套 scroll 容器中行为不可预测

### D6: shadcn/ui 组件使用

**选择:** 安装 Input 组件，不使用 Card

**理由:**
- LibrarianBar 的输入框需要 shadcn/ui Input 组件保持一致性
- BookCard 的布局是自定义的 2:3 封面卡片，shadcn Card 的 header/content/footer 结构不匹配
- 使用原生 div + Tailwind 构建 BookCard 更灵活

**安装命令:**
```bash
npx shadcn-ui@latest add input
```

### D7: Mock 数据结构

**选择:** 在 BookshelfPage.tsx 中定义常量数组，类型对齐 `Book` 接口

```tsx
const MOCK_BOOKS: Book[] = [
  { id: '1', title: '三体', author: '刘慈欣', path: '/books/santi.epub', isIndexed: false },
  // ... 6 本
];
```

**理由:**
- 数据结构直接使用 `shared/types/index.ts` 中定义的 `Book` 接口
- 常量数组放在 BookshelfPage 内部，未来替换为 Zustand store 时改动最小
- 6 本书足以展示网格布局效果

## Risks / Trade-offs

### R1: auto-fill 网格在极端宽度下列数不可控
**风险:** 超宽屏幕（>2560px）可能出现过多列，卡片过小
**缓解:** 添加 `max-w-7xl mx-auto` 限制最大内容宽度

### R2: 固定定位 LibrarianBar 可能遮挡内容
**风险:** 不同分辨率下 pb-20 可能不够
**缓解:** LibrarianBar 高度固定为设计规范的 ~80px，pb-20 (80px) 精确匹配

### R3: Mock 数据可能与未来真实数据不一致
**风险:** `Book` 接口变更后 mock 数据需同步更新
**缓解:** mock 数据严格遵循 `Book` 接口类型检查，TypeScript 编译时自动报错

## Migration Plan

**部署步骤:**
1. 安装 shadcn/ui Input 组件: `npx shadcn-ui@latest add input`
2. 创建 4 个子组件文件到 `src/features/bookshelf/components/`
3. 重写 `BookshelfPage.tsx` 组装子组件
4. TypeScript 编译验证
5. 启动 dev 模式视觉验证

**回滚策略:**
- 纯新增/替换文件，无 Breaking Changes
- 恢复 BookshelfPage.tsx 原始占位内容即可回滚

## Open Questions

**Q1: 是否需要实现 BookCard 点击行为?**
- 设计上点击应跳转到 `/reader/:id`
- **决策:** 本次仅添加 `cursor-pointer` 样式和 `onClick` prop 预留，不实现路由跳转

**Q2: LibrarianBar 是否需要展开/收起能力?**
- 设计参考图 Prompt 3 展示了展开状态（显示对话历史）
- **决策:** 本次仅实现默认收起状态（单行输入框），展开逻辑留给 Agent 集成 change
