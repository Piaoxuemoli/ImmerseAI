## MODIFIED Requirements

### Requirement: 阅读页路由
阅读页 `/reader/:id` SHALL 渲染完整的阅读体验，包含 ReaderHeader、EpubViewer（阅读模式）和 ChatInterface（对话模式），通过 AnimatePresence 切换。

#### Scenario: 阅读模式
- **WHEN** 用户导航到 `/reader/:id` 且 readerMode 为 'read'
- **THEN** 页面渲染 ReaderHeader + EpubViewer
- **AND** 底部无 ChatInput

#### Scenario: 对话模式
- **WHEN** readerMode 为 'chat'
- **THEN** 页面渲染 ReaderHeader + ChatInterface（含 ChatInput）
