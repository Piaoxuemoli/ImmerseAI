## Context

当前 ImmerseAI 的对话界面（ChatInterface）和阅读器（EpubViewer）已各自独立工作。LLM 返回的消息中 `Message.citations` 数组已被 `MessageBubble` → `CitationBadge` 渲染，但 `CitationBadge` 的 `onClick` prop 未被传入，点击无效。`useReader` hook 已实现 `goToCfi(cfi)` 方法（调用 `setReaderMode('read')` + `rendition.display(cfi)`），但 `ReaderPage` 未将其暴露给 Chat 侧。两个模块之间缺少跳转信号通道。

关键现状：
- `CitationBadge` 组件已有 `onClick?: () => void` prop，`disabled={!onClick}`
- `useReader.goToCfi` 已实现模式切换 + CFI 跳转
- Zustand Store 已有 `setReaderMode` 和 `setCurrentCfi` actions
- `ReaderPage` 使用 `AnimatePresence` + `framer-motion` 做 read/chat 模式切换

## Goals / Non-Goals

**Goals:**
- 点击 `CitationBadge` 能跳转到 EPUB 对应位置并高亮引用文本
- chat → read 模式切换使用现有 framer-motion 过渡动画
- 返回 chat 模式后聊天上下文完整保留
- 实现路径尽量利用已有代码，最小化改动量

**Non-Goals:**
- 不实现多本书跨书跳转（仅当前书籍内跳转）
- 不实现高亮持久化（高亮仅在当前会话有效，切书或刷新后消失）
- 不实现高亮样式用户自定义
- 不改变 `CitationBadge` 的视觉设计

## Decisions

### D1: 使用 Zustand Store 作为跳转信号桥（而非 prop drilling）

**选择**: 在 `ImmerseStore` 中新增 `pendingCitationCfi: string | null` + `setPendingCitationCfi` action。`ChatInterface` 中点击 citation 时写入 store，`useReader` hook 中 watch 该值并触发 `goToCfi`。

**替代方案**:
- A) Prop drilling: `ReaderPage` → `ChatInterface` → `MessageBubble` → `CitationBadge` 传递 `goToCfi` 回调。需在 4 级组件间钻孔，ChatInterface 签名变化，耦合度高。
- B) React Context: 创建 ReaderContext 提供 goToCfi。额外引入 Context Provider，而 Zustand 已是项目状态管理方案。

**理由**: Store 方案零 prop drilling、零组件签名变更。`ChatInterface` 只需从 store 取 `setPendingCitationCfi`，`useReader` 通过 `useEffect` 监听 `pendingCitationCfi` 变化调用 `goToCfi`。消费后将其重置为 null。完全符合现有架构模式。

### D2: epubjs annotations API 实现引用高亮

**选择**: 使用 `rendition.annotations.highlight(cfi, {}, callback, className)` 添加高亮。

**理由**: epubjs 内建 annotations API，无需额外依赖。高亮通过自定义 CSS class 注入（`background-color: rgba(251, 191, 36, 0.3)`，amber 半透明）。每次新跳转前清除旧高亮，避免堆积。

### D3: 高亮 CFI 范围处理

**选择**: 使用 RAG 返回的 `citation.cfi` 直接作为高亮 range。如果 CFI 不是 range 格式（无法高亮），则仅跳转不高亮，降级处理。

**理由**: CFI 可能是精确 range 或仅是位置标记。强行推断 range 易出错，降级到"仅跳转"是安全的。

### D4: 回调链路设计

```
CitationBadge(onClick) 
  → MessageBubble(onCitationClick) 
    → ChatInterface（从 store 取 setPendingCitationCfi）
      → Zustand: pendingCitationCfi = cfi
        → useReader: useEffect watch → goToCfi(cfi) + highlight
          → 重置 pendingCitationCfi = null
```

ChatInterface 是链路的粘合层，负责创建 `handleCitationClick(cfi)` 并向下传递。MessageBubble 新增 `onCitationClick?: (cfi: string) => void` prop。

## Risks / Trade-offs

- **[CFI 精度不足]** → RAG 切分的 CFI 可能不够精确，跳转位置可能偏移几段。降级为"跳转到附近"，不阻塞功能。
- **[高亮堆积]** → 多次点击不同引用可能残留旧高亮。在每次新 highlight 前调用 `rendition.annotations.remove(oldCfi)` 清除。
- **[AnimatePresence 过渡与跳转时序]** → 从 chat 切到 read 有动画延迟，`rendition.display(cfi)` 需在动画完成后执行。通过 `useEffect` 监听 `readerMode === 'read'` + `pendingCitationCfi` 双条件确保时序正确。
