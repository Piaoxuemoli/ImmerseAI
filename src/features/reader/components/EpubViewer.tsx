import { ReactReader } from 'react-reader'
import type { Rendition } from 'epubjs'
import { Loader2 } from 'lucide-react'

interface EpubViewerProps {
  blobUrl: string | null
  location: string | number
  onLocationChange: (cfi: string) => void
  onRendition: (rendition: Rendition) => void
}

export function EpubViewer({
  blobUrl,
  location,
  onLocationChange,
  onRendition,
}: EpubViewerProps) {
  if (!blobUrl) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="ml-3 text-sm text-slate-500">正在加载书籍...</span>
      </div>
    )
  }

  return (
    <div className="h-full">
      <ReactReader
        url={blobUrl}
        location={location}
        locationChanged={(loc: string) => onLocationChange(loc)}
        getRendition={(rendition: Rendition) => {
          onRendition(rendition)
          // 自定义阅读器样式
          rendition.themes.default({
            body: {
              'font-family': "'Inter', system-ui, sans-serif",
              'font-size': '18px',
              'line-height': '1.8',
              color: '#0f172a',
            },
          })
        }}
      />
    </div>
  )
}
