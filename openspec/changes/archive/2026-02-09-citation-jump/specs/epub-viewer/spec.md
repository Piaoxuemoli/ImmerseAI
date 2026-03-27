## MODIFIED Requirements

### Requirement: CFI 跳转
系统 SHALL 提供 `goToCfi(cfi: string)` 方法，允许外部触发 EPUB 页面跳转，并支持引用文本高亮。

#### Scenario: 跳转到引用位置
- **WHEN** 外部调用 `goToCfi(cfi)` 方法
- **THEN** 系统调用 `rendition.display(cfi)` 跳转到目标位置
- **AND** 如果当前非阅读模式，先切换到阅读模式

#### Scenario: 跳转后高亮引用文本
- **WHEN** `rendition.display(cfi)` 跳转完成
- **THEN** 系统 SHALL 调用 `rendition.annotations.highlight(cfi)` 添加高亮
- **AND** 高亮样式为 amber 半透明背景（`rgba(251, 191, 36, 0.3)`）
- **AND** 新跳转前 SHALL 先清除上一次的高亮

#### Scenario: 高亮降级
- **WHEN** `rendition.annotations.highlight(cfi)` 调用失败
- **THEN** 系统 SHALL 静默忽略高亮错误
- **AND** 跳转功能 SHALL 正常工作

#### Scenario: Rendition 未就绪
- **WHEN** 调用 goToCfi 但 rendition 尚未初始化
- **THEN** 方法静默忽略，不抛出异常

#### Scenario: 通过 Store 信号触发跳转
- **WHEN** Zustand Store 的 `pendingCitationCfi` 从 null 变为有效 CFI 字符串
- **AND** `readerMode` 为 `'read'`
- **THEN** `useReader` SHALL 自动调用 `goToCfi(pendingCitationCfi)`
- **AND** 调用后 SHALL 重置 `pendingCitationCfi` 为 null
