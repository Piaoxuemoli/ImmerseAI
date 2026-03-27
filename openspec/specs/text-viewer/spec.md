# 文本/Markdown 阅读器规范（变更 delta）

## ADDED Requirements

### Requirement: 文本与 Markdown 文件加载
`useReader(bookId)`（或等价 hook）SHALL 通过 `window.electronAPI.mcp.readFile(book.path)` 获取 .md 或 .txt 文件的文本内容（UTF-8 字符串），供文本/Markdown 查看器渲染。

#### Scenario: 正常加载
- **WHEN** ReaderPage 挂载且 bookId 对应的 Book 存在且 path 为 .md 或 .txt
- **THEN** hook 调用 `mcp.readFile(book.path)` 获取文本内容
- **AND** 将内容交给 text-viewer 组件
- **AND** 设置 loading 为 false

#### Scenario: 加载失败
- **WHEN** `mcp.readFile` 调用抛出异常
- **THEN** hook 设置 error 状态
- **AND** UI 显示错误提示

#### Scenario: 组件卸载清理
- **WHEN** 使用 useReader 的组件卸载
- **THEN** hook SHALL 释放与当前书籍相关的引用或订阅，无 Blob URL 时无需 revokeObjectURL

### Requirement: 文本与 Markdown 渲染
文本查看器组件 SHALL 根据文件扩展名渲染内容：.txt 按纯文本渲染；.md 使用 Markdown 渲染（如 react-markdown 或等价实现）。

#### Scenario: 渲染纯文本
- **WHEN** 书籍 path 以 .txt 结尾且内容已加载
- **THEN** 组件以纯文本形式展示内容（保留换行，无 Markdown 解析）
- **AND** 使用可读字体与行高（如 Inter、行高 1.8）

#### Scenario: 渲染 Markdown
- **WHEN** 书籍 path 以 .md 结尾且内容已加载
- **THEN** 组件使用 Markdown 渲染器展示内容（标题、列表、代码块等）
- **AND** 样式与 Notion 极简风格一致（slate 色系）

### Requirement: 阅读进度持久化（段落/偏移）
系统 SHALL 在用户滚动或翻页时，将阅读进度保存为段落索引或字符偏移（不使用 CFI）。

#### Scenario: 保存进度
- **WHEN** 用户滚动或位置变化且可解析出当前段落或偏移
- **THEN** 系统更新 store 中该书对应的进度（如 lastReadParagraphIndex 或 lastReadOffset）
- **AND** 更新 lastReadAt 时间戳

#### Scenario: 恢复进度
- **WHEN** 用户重新打开已阅读的 .md/.txt 书籍
- **THEN** 系统从 Book 的进度字段读取上次位置
- **AND** 将查看器滚动或定位到该段落/偏移

### Requirement: 引用跳转（可选简化）
若系统保留引用/高亮能力，SHALL 使用段落或偏移定位，不依赖 CFI；跳转接口可为 `goToParagraph(index)` 或等价形式。

#### Scenario: 跳转到段落
- **WHEN** 外部调用跳转方法（如 goToParagraph(index)）
- **THEN** 查看器滚动到对应段落
- **AND** 可选高亮该段（样式与现有引用高亮一致时）

#### Scenario: 无 Rendition 时的行为
- **WHEN** 调用跳转但查看器尚未就绪
- **THEN** 方法静默忽略或排队至就绪后执行，不抛出异常
