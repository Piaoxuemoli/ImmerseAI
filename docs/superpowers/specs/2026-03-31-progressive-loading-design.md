# 大文档渐进加载设计规格

## 概述

优化大文档（txt/md）的阅读加载体验：用户打开书籍后立即看到上一次阅读位置附近的内容，无需等待全文加载。

## 核心策略

| 阶段 | 加载范围 | 说明 |
|------|----------|------|
| 第1步 | 最后阅读位置 ± 一屏 | 用户立即可阅读 |
| 第2步 | 后台渐进填充全文 | 不阻塞用户操作 |
| 第3步 | 全文加载完成 | 启用全文搜索等 |

## 与 RAG 的关系

- **完全解耦**：RAG 异步索引，丝毫不影响阅读加载
- 两者可并行执行

---

## 实现方案

### 1. TextViewer 改造

```tsx
interface TextViewerProps {
  content: string | null        // null = 加载中
  loadedContent: string | null   // 已加载部分（渐进）
  loadProgress: number          // 0-100 加载进度
  // ... 其他 props
}
```

### 2. 加载逻辑（useReader）

```
1. 读取文件 → 获得完整 content
2. 解析段落数组
3. 计算"最后阅读位置附近"作为起始渲染点
4. 立即渲染这部分（用户可读）
5. 后台 requestIdleCallback 渐进加载全文
6. 全文加载完成后更新状态
```

### 3. 骨架屏

```tsx
{!loadedContent && (
  <div className="animate-pulse space-y-4 p-8">
    <div className="h-4 bg-muted rounded w-3/4" />
    <div className="h-4 bg-muted rounded" />
    <div className="h-4 bg-muted rounded w-1/2" />
    {/* 显示加载进度 */}
    <div className="text-sm text-muted-foreground">
      正在加载... {loadProgress}%
    </div>
  </div>
)}
```

### 4. 渐进加载函数

```tsx
async function loadContentProgressive(
  paragraphs: string[],
  startIndex: number,
  onPartialLoad: (content: string) => void,
  onProgress: (percent: number) => void
) {
  // 先加载起始位置附近
  const initialRange = paragraphs.slice(
    Math.max(0, startIndex - 5),
    startIndex + 20
  )
  onPartialLoad(initialRange.join('\n\n'))
  onProgress(10)

  // 后台渐进加载剩余
  const BATCH_SIZE = 50
  for (let i = 0; i < paragraphs.length; i += BATCH_SIZE) {
    await new Promise(resolve => requestIdleCallback(resolve))
    if (i < startIndex - 5 || i >= startIndex + 20) {
      // 只更新尚未加载的部分
    }
    onProgress(Math.floor((i / paragraphs.length) * 100))
  }

  onProgress(100)
  return paragraphs.join('\n\n')
}
```

---

## 文件变更

- `src/features/reader/hooks/useReader.ts` - 渐进加载逻辑
- `src/features/reader/components/TextViewer.tsx` - 骨架屏 + 加载状态
- `src/features/reader/components/ReadingLoadingSkeleton.tsx` - 可能需要增强

---

## 验证标准

1. 大文档（>1MB）打开后 1 秒内可见内容
2. 加载过程不阻塞滚动和阅读
3. 进度指示器显示加载状态
4. 全文加载完成后功能正常（全文搜索等）
