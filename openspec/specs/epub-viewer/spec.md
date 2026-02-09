# EPUB 阅读器规范

## 目的
定义 EPUB 渲染组件、数据加载、阅读进度管理和 CFI 跳转能力。

## 需求

### Requirement: EPUB 文件加载
`useReader(bookId)` hook SHALL 通过 IPC 调用 `window.electronAPI.mcp.readFile(book.path)` 获取 EPUB 文件的 ArrayBuffer，并转换为 Blob URL 供 react-reader 使用。

#### Scenario: 正常加载
- **WHEN** ReaderPage 挂载且 bookId 对应的 Book 存在
- **THEN** hook 调用 `mcp.readFile(book.path)` 获取 ArrayBuffer
- **AND** 创建 `new Blob([arrayBuffer], { type: 'application/epub+zip' })`
- **AND** 通过 `URL.createObjectURL(blob)` 生成 Blob URL
- **AND** 设置 loading 为 false

#### Scenario: 加载失败
- **WHEN** `mcp.readFile` 调用抛出异常
- **THEN** hook 设置 error 状态
- **AND** UI 显示错误提示

#### Scenario: 组件卸载清理
- **WHEN** 使用 useReader 的组件卸载
- **THEN** hook SHALL 调用 `URL.revokeObjectURL(blobUrl)` 释放内存

### Requirement: EPUB 渲染
`EpubViewer` 组件 SHALL 使用 react-reader 的 `ReactReader` 组件渲染 EPUB 内容。

#### Scenario: 渲染 EPUB
- **WHEN** Blob URL 准备就绪
- **THEN** 组件传递 `url={blobUrl}` 给 ReactReader
- **AND** 传递 `location={currentLocation}` 控制当前页面
- **AND** 传递 `locationChanged` 回调更新位置
- **AND** 通过 `getRendition` 回调获取 Rendition 引用

#### Scenario: 自定义阅读器样式
- **WHEN** `getRendition` 回调触发
- **THEN** 组件通过 `rendition.themes.default()` 设置字体为 Inter、字号 18px、行高 1.8、颜色 slate-900

### Requirement: 阅读进度持久化
系统 SHALL 在用户翻页时自动保存阅读进度。

#### Scenario: 保存进度
- **WHEN** `locationChanged` 回调触发且 loc 为有效 CFI 字符串
- **THEN** 系统更新 `store.setCurrentCfi(cfi)`
- **AND** 更新对应 Book 的 `lastReadCfi` 字段
- **AND** 更新 `lastReadAt` 时间戳

#### Scenario: 恢复进度
- **WHEN** 用户重新打开已阅读的书籍
- **THEN** 系统从 `Book.lastReadCfi` 读取上次位置
- **AND** 将其作为 ReactReader 的初始 `location`

### Requirement: CFI 跳转
系统 SHALL 提供 `goToCfi(cfi: string)` 方法，允许外部触发 EPUB 页面跳转。

#### Scenario: 跳转到引用位置
- **WHEN** 外部调用 `goToCfi(cfi)` 方法
- **THEN** 系统调用 `rendition.display(cfi)` 跳转到目标位置
- **AND** 如果当前非阅读模式，先切换到阅读模式

#### Scenario: Rendition 未就绪
- **WHEN** 调用 goToCfi 但 rendition 尚未初始化
- **THEN** 方法静默忽略，不抛出异常
