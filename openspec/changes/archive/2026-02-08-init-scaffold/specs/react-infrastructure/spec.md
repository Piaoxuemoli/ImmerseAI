## ADDED Requirements

### Requirement: React 应用入口
系统 SHALL 在 src/main.tsx 创建 React 18 应用入口，使用 createRoot API。

#### Scenario: React 挂载
- WHEN 应用启动
- THEN React 通过 createRoot 挂载到 #root DOM 节点
- AND 启用 React 18 并发特性

### Requirement: 路由配置
系统 SHALL 使用 react-router-dom v6 配置应用路由。

#### Scenario: 书架页路由
- WHEN 用户访问根路径 /
- THEN 重定向到 /bookshelf
- AND 渲染 BookshelfPage 组件

#### Scenario: 阅读页路由
- WHEN 用户访问 /reader/:id
- THEN 渲染 ReaderPage 组件
- AND URL 参数 id 作为书籍标识符

#### Scenario: 404 处理
- WHEN 用户访问不存在的路由
- THEN 重定向到 /bookshelf
- AND 不显示任何错误页面

### Requirement: Provider 组合
系统 SHALL 在应用根组件组合必要的 Context Provider。

#### Scenario: Router Provider
- WHEN 应用渲染
- THEN RouterProvider 包裹所有路由组件
- AND 提供路由上下文

#### Scenario: 未来扩展
- WHEN 需要添加全局 Provider（如 Theme, i18n）
- THEN 在 src/app/providers.tsx 中统一配置
- AND 保持根组件简洁

### Requirement: 仅使用函数组件
系统 SHALL 禁止使用 React Class Components，所有组件必须是函数组件 + Hooks。

#### Scenario: 组件代码审查
- WHEN 创建新组件
- THEN 使用函数式声明（const Component = () => {}）
- AND 使用 Hooks（useState, useEffect 等）管理状态和副作用
- AND 不使用 class 关键字定义组件
