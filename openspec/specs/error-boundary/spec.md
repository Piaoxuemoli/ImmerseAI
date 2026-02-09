## Requirements

### Requirement: 根应用 Error Boundary
系统 SHALL 使用 React Error Boundary（class 组件）包裹根应用，捕获子树中的渲染错误并展示降级 UI，避免整页白屏。

#### Scenario: 捕获渲染错误
- **WHEN** 根组件子树内任意组件在渲染阶段抛出错误（含生命周期中抛出的同步错误）
- **THEN** Error Boundary 的 `componentDidCatch` 被触发
- **AND** 错误被捕获，不向上冒泡导致整页白屏

#### Scenario: 降级 UI 展示
- **WHEN** Error Boundary 捕获到错误
- **THEN** 页面 SHALL 展示降级 UI（非白屏）
- **AND** 降级 UI 至少包含简短错误说明（可来自 `error.message` 或固定文案）
- **AND** 提供「重新加载」或等价操作（如 `window.location.reload()`），供用户恢复使用

#### Scenario: 错误日志
- **WHEN** Error Boundary 捕获到错误
- **THEN** 系统 SHALL 将错误记录到控制台（如 `console.error`）
- **AND** 可选预留上报回调，不在本能力内实现远程上报

#### Scenario: 放置位置
- **WHEN** 应用启动
- **THEN** Error Boundary 组件 SHALL 包裹在 React 根组件（如 `App` 或 `main.tsx` 渲染的根）最外层
- **AND** 所有路由与业务组件均处于该 Boundary 子树内
