import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import { Toaster } from './shared/components/ui/sonner'
import './styles/globals.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Failed to find the root element')
}

const root = ReactDOM.createRoot(rootElement)

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster position="top-right" richColors closeButton />
    </ErrorBoundary>
  </React.StrictMode>
)
