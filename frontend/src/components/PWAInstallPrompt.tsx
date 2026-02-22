import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Globe, CheckCircle2, Share2, Plus, Menu } from 'lucide-react'
import { cn } from '../lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAInstallPromptProps {
  className?: string
}

export function PWAInstallPrompt({ className }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown')
  const [browser, setBrowser] = useState<'safari' | 'chrome' | 'firefox' | 'opera' | 'brave' | 'edge' | 'other'>('other')

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Detect platform and browser
    const ua = window.navigator.userAgent.toLowerCase()

    // Detect platform
    const isIOS = /iphone|ipad|ipod/.test(ua)
    const isAndroid = /android/.test(ua)

    if (isIOS) {
      setPlatform('ios')
    } else if (isAndroid) {
      setPlatform('android')
    } else {
      setPlatform('desktop')
    }

    // Detect browser
    if (/safari/.test(ua) && !/chrome|chromium|edg|firefox|opera|opr|brave/.test(ua)) {
      setBrowser('safari')
    } else if (/chrome/.test(ua) && !/edg|opera|opr/.test(ua)) {
      setBrowser('chrome')
    } else if (/firefox/.test(ua)) {
      setBrowser('firefox')
    } else if (/opera|opr/.test(ua)) {
      setBrowser('opera')
    } else if (/brave/.test(ua)) {
      setBrowser('brave')
    } else if (/edg/.test(ua)) {
      setBrowser('edge')
    }

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches
    const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches
    const isPWAInstalled = isStandalone || isFullscreen || isMinimalUI || (window.navigator as any).standalone

    if (isPWAInstalled) {
      setIsInstalled(true)
      return
    }

    // Listen for beforeinstallprompt event (Android Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Android Chrome - use native prompt
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setShowPrompt(false)
      }
      setDeferredPrompt(null)
    } else if (platform === 'android') {
      // Android - show instructions
      setShowPrompt(false)
    } else if (platform === 'ios') {
      // iOS - show instructions
      setShowPrompt(false)
    }
  }

  // Show prompt after delay or if deferredPrompt is available
  useEffect(() => {
    if (isInstalled) {
      setShowPrompt(false)
      return
    }

    // Check if user dismissed recently (within 24 hours)
    const dismissedTime = localStorage.getItem('pwa_install_dismissed')
    if (dismissedTime && Date.now() - parseInt(dismissedTime) < 24 * 60 * 60 * 1000) {
      setShowPrompt(false)
      return
    }

    // Show on all platforms (iOS, Android, Desktop) - automatic installation prompt
    // Show prompt after delay or if deferredPrompt is available
    if (deferredPrompt || platform === 'ios' || platform === 'android' || platform === 'desktop') {
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [deferredPrompt, platform, isInstalled])

  const handleDismiss = () => {
    setShowPrompt(false)
    // Store dismissal in localStorage
    localStorage.setItem('pwa_install_dismissed', Date.now().toString())
  }

  // Don't show if already installed
  if (isInstalled) {
    return null
  }

  // Check if user dismissed recently (within 24 hours)
  const dismissedTime = localStorage.getItem('pwa_install_dismissed')
  if (dismissedTime && Date.now() - parseInt(dismissedTime) < 24 * 60 * 60 * 1000) {
    return null
  }

  // Show on all platforms (iOS, Android, Desktop)
  // No platform restriction

  if (!showPrompt) {
    return null
  }

  // iOS Safari Instructions - English, Responsive
  const iOSInstructions = (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 sm:p-3">
        <Share2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-white">1. Tap the Share button</p>
          <p className="text-[10px] sm:text-xs text-blue-200/80">At the bottom of Safari, tap the share icon</p>
        </div>
      </div>
      <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 sm:p-3">
        <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-white">2. Select "Add to Home Screen"</p>
          <p className="text-[10px] sm:text-xs text-blue-200/80">Scroll down and tap "Add to Home Screen"</p>
        </div>
      </div>
      <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 sm:p-3">
        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-white">3. Confirm installation</p>
          <p className="text-[10px] sm:text-xs text-blue-200/80">Tap "Add" to complete installation</p>
        </div>
      </div>
    </div>
  )

  // Android Chrome Instructions - English, Responsive
  const AndroidChromeInstructions = (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-2 sm:p-3">
        <Download className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-white">1. Tap the "Install" button</p>
          <p className="text-[10px] sm:text-xs text-green-200/80">A banner will appear at the top of Chrome</p>
        </div>
      </div>
      <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-2 sm:p-3">
        <Menu className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-white">2. Or from the menu</p>
          <p className="text-[10px] sm:text-xs text-green-200/80">Tap menu (⋮) → "Install app" or "Add to home screen"</p>
        </div>
      </div>
    </div>
  )

  // Android Firefox Instructions - English, Responsive
  const AndroidFirefoxInstructions = (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 sm:p-3">
        <Menu className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-white">1. Tap the menu (☰)</p>
          <p className="text-[10px] sm:text-xs text-orange-200/80">In the top right corner of Firefox</p>
        </div>
      </div>
      <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 sm:p-3">
        <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-white">2. Select "Install"</p>
          <p className="text-[10px] sm:text-xs text-orange-200/80">Tap "Install" or "Add to home screen"</p>
        </div>
      </div>
    </div>
  )

  // Desktop Instructions - English
  const DesktopInstructions = (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
        <Download className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-white">1. Look for the install icon</p>
          <p className="text-xs text-purple-200/80">
            {browser === 'chrome' && 'In Chrome address bar, look for the install icon (➕)'}
            {browser === 'edge' && 'In Edge address bar, look for the install icon (➕)'}
            {browser === 'firefox' && 'In Firefox address bar, look for the install icon (➕)'}
            {browser === 'opera' && 'In Opera address bar, look for the install icon (➕)'}
            {browser === 'brave' && 'In Brave address bar, look for the install icon (➕)'}
            {browser === 'safari' && 'In Safari, go to File → Add to Home Screen'}
            {browser === 'other' && 'Look for the install icon in the address bar'}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
        <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-white">2. Click "Install"</p>
          <p className="text-xs text-purple-200/80">Confirm installation when the message appears</p>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[100] mx-auto max-w-md rounded-t-2xl border-t border-l border-r border-primary-500/30 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-3 sm:p-4 shadow-2xl transition-all duration-300 safe-area-bottom',
        className
      )}
      style={{
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))',
      }}
    >
      {/* Header - Responsive */}
      <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg flex-shrink-0">
            <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">Install Bright Works</h3>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate">
              {platform === 'ios' && 'iOS'}
              {platform === 'android' && 'Android'}
              {platform === 'desktop' && 'Desktop'}
              {browser !== 'other' && ` • ${browser.charAt(0).toUpperCase() + browser.slice(1)}`}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white flex-shrink-0 touch-target"
          aria-label="Close"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      {/* Instructions - Responsive with safe area */}
      <div 
        className="mb-4 max-h-[50vh] overflow-y-auto overscroll-contain"
        style={{
          maxHeight: 'calc(50vh - env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {platform === 'ios' && iOSInstructions}
        {platform === 'android' && browser === 'chrome' && (deferredPrompt ? null : AndroidChromeInstructions)}
        {platform === 'android' && browser === 'firefox' && AndroidFirefoxInstructions}
        {platform === 'android' && browser !== 'chrome' && browser !== 'firefox' && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold text-white">Instructions for {browser}</p>
            <p className="mt-1 text-xs text-amber-200/80">
              Use the {browser} menu and look for "Install" or "Add to home screen"
            </p>
          </div>
        )}
        {platform === 'desktop' && DesktopInstructions}
      </div>

      {/* Install Button - Responsive with safe touch target */}
      {deferredPrompt && (
        <button
          onClick={handleInstall}
          className="w-full rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3 sm:py-3.5 text-sm font-bold text-white shadow-lg transition hover:from-primary-600 hover:to-primary-700 active:scale-95 touch-target"
          style={{ minHeight: '44px' }}
        >
          <div className="flex items-center justify-center gap-2">
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Install Now</span>
          </div>
        </button>
      )}

      {/* Browser Options - Responsive */}
      {(platform === 'android' || platform === 'ios' || platform === 'desktop') && (
        <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide">Also available on:</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {platform === 'ios' && (
              <>
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5">
                  <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-white whitespace-nowrap">Safari</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5">
                  <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-white whitespace-nowrap">Chrome</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5">
                  <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-white whitespace-nowrap">Firefox</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5">
                  <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-white whitespace-nowrap">Brave</span>
                </div>
              </>
            )}
            {platform === 'android' && (
              <>
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5">
                  <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-white whitespace-nowrap">Chrome</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5">
                  <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-white whitespace-nowrap">Firefox</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5">
                  <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-white whitespace-nowrap">Opera</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5">
                  <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-white whitespace-nowrap">Brave</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

