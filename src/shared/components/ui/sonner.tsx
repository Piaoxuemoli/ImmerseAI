/**
 * Toast 组件 - 基于 Sonner
 *
 * 提供全局错误通知与消息提示
 * 使用 shadcn/ui 的 Sonner 方案
 */

import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-950 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-slate-500',
          actionButton:
            'group-[.toast]:bg-slate-900 group-[.toast]:text-slate-50',
          cancelButton:
            'group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500',
          error:
            'group-[.toaster]:bg-red-50 group-[.toaster]:text-red-900 group-[.toaster]:border-red-200',
          success:
            'group-[.toaster]:bg-green-50 group-[.toaster]:text-green-900 group-[.toaster]:border-green-200',
          warning:
            'group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-900 group-[.toaster]:border-amber-200',
        },
      }}
      {...props}
    />
  )
}

// Re-export toast function for convenience
export { toast } from 'sonner'
