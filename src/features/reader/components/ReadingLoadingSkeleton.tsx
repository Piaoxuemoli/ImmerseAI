/** 阅读器加载中的骨架屏 — 模拟文章段落排版，避免白屏 */
export function ReadingLoadingSkeleton() {
  return (
    <div className="h-full overflow-hidden px-8 py-6 bg-background">
      <div className="max-w-3xl mx-auto animate-pulse">
        {/* 标题行 */}
        <div className="h-7 bg-border rounded-md w-3/5 mb-8" />

        {/* 段落块 × 3 */}
        {Array.from({ length: 3 }).map((_, gi) => (
          <div key={gi} className="mb-8 space-y-3">
            <div className="h-4 bg-border rounded w-full" />
            <div className="h-4 bg-border rounded w-full" />
            <div className="h-4 bg-border rounded w-5/6" />
            <div className="h-4 bg-border rounded w-full" />
            <div className="h-4 bg-border rounded w-4/5" />
          </div>
        ))}

        {/* 小标题行 */}
        <div className="h-5 bg-border rounded w-2/5 mb-5" />

        {/* 段落块 × 2 */}
        {Array.from({ length: 2 }).map((_, gi) => (
          <div key={gi} className="mb-8 space-y-3">
            <div className="h-4 bg-border rounded w-full" />
            <div className="h-4 bg-border rounded w-full" />
            <div className="h-4 bg-border rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
