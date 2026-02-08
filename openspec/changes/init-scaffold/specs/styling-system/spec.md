## ADDED Requirements

### Requirement: TailwindCSS 配置
系统 SHALL 配置 TailwindCSS v3+，使用 Notion 极简风格色板。

#### Scenario: 颜色主题定义
- WHEN tailwind.config.ts 初始化
- THEN 定义自定义色板
```ts
colors: {
  primary: 'slate-900',      // #0f172a
  secondary: 'slate-500',    // #64748b
  background: 'white',       // #ffffff
  muted: 'slate-50',         // #f8fafc
  border: 'slate-200',       // #e2e8f0
  accent: 'slate-800',       // #1e293b
  destructive: 'red-500',
  success: 'green-500',
}
```

#### Scenario: 字体配置
- WHEN 配置字体族
- THEN 设置 fontFamily.sans 为 ['Inter', 'system-ui', 'sans-serif']
- AND Inter 字体文件本地化（避免 Google Fonts CDN）

#### Scenario: 间距系统
- WHEN 使用间距工具类
- THEN 遵循 4px 网格系统（p-1/2/4/6/8）
- AND 保持视觉一致性

### Requirement: shadcn/ui 集成
系统 SHALL 集成 shadcn/ui 组件库，基于 Radix UI primitives。

#### Scenario: shadcn/ui 初始化
- WHEN 运行 `npx shadcn-ui@latest init`
- THEN 创建 components.json 配置文件
- AND 设置组件输出路径为 src/shared/components/ui

#### Scenario: 组件安装
- WHEN 需要使用 shadcn/ui 组件
- THEN 通过 `npx shadcn-ui@latest add <component>` 安装
- AND 组件代码复制到 src/shared/components/ui/
- AND 组件完全可控，可自由修改

### Requirement: 设计 token 统一
系统 SHALL 通过 TailwindCSS 配置统一管理设计 token（颜色、字体、间距、圆角）。

#### Scenario: 圆角定义
- WHEN 定义圆角规范
- THEN 卡片使用 rounded-lg (8px)
- AND 按钮使用 rounded-md (6px)
- AND 输入框使用 rounded-md (6px)

#### Scenario: 阴影定义
- WHEN 需要使用阴影
- THEN 仅对提升元素（弹窗、下拉框）使用 shadow-sm
- AND 避免过度使用阴影，保持极简风格

### Requirement: lucide-react 图标
系统 SHALL 使用 lucide-react 作为唯一图标库。

#### Scenario: 图标使用
- WHEN 需要图标
- THEN 从 lucide-react 引入对应组件
- AND 使用 className 控制尺寸和颜色
- AND 不使用其他图标库（如 react-icons, heroicons）
