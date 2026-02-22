import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

// Suppress Phantom wallet and SES lockdown extension errors
// This runs AFTER the inline script in index.html for double protection
if (typeof window !== 'undefined') {
  const suppressMessages = [
    'Could not establish connection',
    'Receiving end does not exist',
    'error getting provider injection',
    'error updating cache',
    'PHANTOM',
    'SES Removing unpermitted intrinsics',
    'lockdown-install.js',
    'solanaActionsContentScript',
    'Removing intrinsics',
    '%MapPrototype%',
    '%WeakMapPrototype%',
    '%DatePrototype%',
    'getOrInsert',
    'getOrInsertComputed',
    'toTemporalInstant',
    'unpermitted intrinsics',
    'intrinsics.',
    'lockdown',
    'ES Removing'
  ]
  
  const shouldSuppress = (message: string): boolean => {
    const msg = String(message || '').toLowerCase()
    return suppressMessages.some(suppressed => msg.includes(suppressed.toLowerCase()))
  }
  
  // Override console methods if not already overridden
  if (!(console.warn as any).__brightworks_suppressed) {
    const originalWarn = console.warn
    console.warn = function(...args: unknown[]) {
      const message = args.join(' ')
      if (!shouldSuppress(message)) {
        originalWarn.apply(console, args)
      }
    }
    ;(console.warn as any).__brightworks_suppressed = true
  }
  
  if (!(console.error as any).__brightworks_suppressed) {
    const originalError = console.error
    console.error = function(...args: unknown[]) {
      const message = args.join(' ')
      if (!shouldSuppress(message)) {
        originalError.apply(console, args)
      }
    }
    ;(console.error as any).__brightworks_suppressed = true
  }

  // Suppress unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || String(event.reason || '')
    if (shouldSuppress(message)) {
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  }, true)
  
  // Suppress all error events
  window.addEventListener('error', (event) => {
    const message = (event.message || event.filename || '').toLowerCase()
    if (shouldSuppress(message)) {
      event.preventDefault()
      event.stopPropagation()
      return false
    }
    // Source map errors
    if (
      event.filename?.includes('.map') ||
      event.message?.includes('source map') ||
      event.message?.includes('.map')
    ) {
      event.preventDefault()
      return false
    }
  }, true)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const theme = localStorage.getItem('brightworks_theme') || 'default'
    document.documentElement.setAttribute('data-theme', theme)
    
    // ELIMINAR COMPLETAMENTE EL FILTRO CSS PARA PREVENIR BLUR
    // El filtro de brightness/contrast causa problemas de renderizado y blur
    document.documentElement.style.filter = ''
    
    // Resetear valores problemáticos en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_brightness', '100')
      localStorage.setItem('brightworks_contrast', '100')
    }
  }, [])

  return <>{children}</>
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
