/**
 * 全局错误边界组件
 *
 * 捕获渲染阶段错误，展示降级 UI 并提供重新加载选项
 */

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { Button } from './ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] 渲染错误:', error)
    console.error('[ErrorBoundary] 组件栈:', errorInfo.componentStack)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 p-8">
          <div className="max-w-md text-center">
            <div className="mb-4 text-6xl">😵</div>
            <h1 className="mb-2 text-xl font-semibold text-slate-900">
              应用出现了问题
            </h1>
            <p className="mb-6 text-sm text-slate-600">
              发生了一个意外错误，请尝试重新加载页面。如果问题持续存在，请联系支持。
            </p>
            {this.state.error && (
              <details className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-left">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  错误详情
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-slate-500">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <Button onClick={this.handleReload} className="w-full">
              重新加载
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
