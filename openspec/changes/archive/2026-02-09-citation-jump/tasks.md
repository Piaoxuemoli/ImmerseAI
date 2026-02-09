## 1. Store 扩展

- [x] 1.1 在 `src/shared/types/index.ts` 的 ImmerseStore 接口中添加 `pendingCitationCfi: string | null` 字段和 `setPendingCitationCfi: (cfi: string | null) => void` action
- [x] 1.2 在 `src/shared/store/index.ts` 中实现 `pendingCitationCfi` 初始值 (null) 和 `setPendingCitationCfi` action（不持久化）

## 2. 回调链路（Chat 侧）

- [x] 2.1 修改 `MessageBubble` 组件：新增 `onCitationClick?: (cfi: string) => void` prop，传递给每个 `CitationBadge` 的 `onClick`
- [x] 2.2 修改 `ChatInterface` 组件：从 store 取 `setPendingCitationCfi` 和 `setReaderMode`，创建 `handleCitationClick(cfi)` 回调并传递给每个 `MessageBubble`

## 3. 跳转与高亮（Reader 侧）

- [x] 3.1 修改 `useReader` hook：添加 `useEffect` 监听 `pendingCitationCfi` 变化，当非 null 时调用 `goToCfi(cfi)` 并重置为 null
- [x] 3.2 修改 `useReader` hook：在 `goToCfi` 中增加 epubjs annotations 高亮逻辑（highlight + 清除旧高亮 + 降级处理）

## 4. 验证

- [x] 4.1 运行 `npx electron-vite build` 确认编译零错误
