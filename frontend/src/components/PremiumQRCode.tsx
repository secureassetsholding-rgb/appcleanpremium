import { useState, useEffect } from 'react'
import QRCode from 'react-qr-code'
import { Globe, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { cn } from '../lib/utils'

interface PremiumQRCodeProps {
  value: string
  className?: string
}

export function PremiumQRCode({ value, className }: PremiumQRCodeProps) {
  const [showInstructions, setShowInstructions] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown')
  const [browser, setBrowser] = useState<'safari' | 'chrome' | 'firefox' | 'opera' | 'brave' | 'edge' | 'other'>('other')
  
  // Ensure we have a valid URL - direct to root for automatic redirect to login/home
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brightworks.app'
  const qrValue = value || baseUrl
  
  // Ensure URL doesn't have trailing slash and goes directly to root
  const cleanUrl = qrValue.replace(/\/$/, '')
  
  useEffect(() => {
    if (typeof window === 'undefined') return

    const ua = window.navigator.userAgent.toLowerCase()
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
  }, [])

  const handleOpenInBrowser = (browserName: string) => {
    const url = cleanUrl
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // iOS Safari Instructions - Spanish
  const iOSInstructions = (
    <div className="space-y-2 mt-2">
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-300 flex-shrink-0 mt-0.5">
          1
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">Toca el botón Compartir</p>
          <p className="text-[10px] text-blue-200/80 mt-0.5">En la parte inferior de Safari</p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-300 flex-shrink-0 mt-0.5">
          2
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">Selecciona "Añadir a la pantalla de inicio"</p>
          <p className="text-[10px] text-blue-200/80 mt-0.5">Desplázate hacia abajo y toca la opción</p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-300 flex-shrink-0 mt-0.5">
          3
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">Toca "Añadir"</p>
          <p className="text-[10px] text-blue-200/80 mt-0.5">Confirma la instalación</p>
        </div>
      </div>
    </div>
  )

  // Android Chrome Instructions - Spanish
  const AndroidChromeInstructions = (
    <div className="space-y-1.5 sm:space-y-2 mt-2">
      <div className="flex items-start gap-1.5 sm:gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-1.5 sm:p-2">
        <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-green-500/20 text-[10px] sm:text-xs font-bold text-green-300 flex-shrink-0 mt-0.5">
          1
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-white">Toca el botón "Instalar"</p>
          <p className="text-[9px] sm:text-[10px] text-green-200/80 mt-0.5">Aparecerá un banner en Chrome</p>
        </div>
      </div>
      <div className="flex items-start gap-1.5 sm:gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-1.5 sm:p-2">
        <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-green-500/20 text-[10px] sm:text-xs font-bold text-green-300 flex-shrink-0 mt-0.5">
          2
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-white">O desde el menú (⋮)</p>
          <p className="text-[9px] sm:text-[10px] text-green-200/80 mt-0.5">Selecciona "Instalar aplicación"</p>
        </div>
      </div>
    </div>
  )

  // Android Firefox Instructions - Spanish
  const AndroidFirefoxInstructions = (
    <div className="space-y-1.5 sm:space-y-2 mt-2">
      <div className="flex items-start gap-1.5 sm:gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-1.5 sm:p-2">
        <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-orange-500/20 text-[10px] sm:text-xs font-bold text-orange-300 flex-shrink-0 mt-0.5">
          1
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-white">Toca el menú (☰)</p>
          <p className="text-[9px] sm:text-[10px] text-orange-200/80 mt-0.5">En la esquina superior derecha</p>
        </div>
      </div>
      <div className="flex items-start gap-1.5 sm:gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-1.5 sm:p-2">
        <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-orange-500/20 text-[10px] sm:text-xs font-bold text-orange-300 flex-shrink-0 mt-0.5">
          2
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-white">Selecciona "Instalar"</p>
          <p className="text-[9px] sm:text-[10px] text-orange-200/80 mt-0.5">O "Añadir a la pantalla de inicio"</p>
        </div>
      </div>
    </div>
  )

  // Browser options with clickable buttons - Spanish
  const browserOptions = (
    <div className="mt-2 space-y-1.5">
      <p className="text-[10px] sm:text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Abrir en navegador:</p>
      <div className="flex flex-wrap gap-1 sm:gap-1.5">
        {platform === 'ios' && (
          <>
            <button
              onClick={() => handleOpenInBrowser('safari')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors touch-manipulation"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Safari</span>
            </button>
            <button
              onClick={() => handleOpenInBrowser('chrome')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors touch-manipulation"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Chrome</span>
            </button>
            <button
              onClick={() => handleOpenInBrowser('firefox')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors touch-manipulation"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-orange-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Firefox</span>
            </button>
            <button
              onClick={() => handleOpenInBrowser('brave')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors touch-manipulation"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Brave</span>
            </button>
          </>
        )}
        {platform === 'android' && (
          <>
            <button
              onClick={() => handleOpenInBrowser('chrome')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors touch-manipulation"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Chrome</span>
            </button>
            <button
              onClick={() => handleOpenInBrowser('firefox')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors touch-manipulation"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-orange-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Firefox</span>
            </button>
            <button
              onClick={() => handleOpenInBrowser('opera')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors touch-manipulation"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Opera</span>
            </button>
            <button
              onClick={() => handleOpenInBrowser('brave')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors touch-manipulation"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-orange-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Brave</span>
            </button>
          </>
        )}
        {(platform === 'desktop' || platform === 'unknown') && (
          <>
            <button
              onClick={() => handleOpenInBrowser('chrome')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Chrome</span>
            </button>
            <button
              onClick={() => handleOpenInBrowser('firefox')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-orange-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Firefox</span>
            </button>
            <button
              onClick={() => handleOpenInBrowser('edge')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Edge</span>
            </button>
            <button
              onClick={() => handleOpenInBrowser('safari')}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-slate-700/50 transition-colors"
            >
              <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[8px] font-medium text-white whitespace-nowrap">Safari</span>
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 text-center',
        className
      )}
    >
      {/* Fashion QR Code - Using Original Image */}
      <div className="relative flex flex-col items-center w-full max-w-[220px] sm:max-w-[200px] md:max-w-[180px]">
        {/* Circular Container with Fashion Style */}
        <div className="relative w-full aspect-square">
          {/* Outer Dark Blue Ring */}
          <div className="absolute inset-0 rounded-full">
            <div className="w-full h-full rounded-full border-[10px] sm:border-[8px] md:border-[6px] border-[#1e3a8a] shadow-xl"></div>
          </div>
          
          {/* Light Blue Arc at Top */}
          <div className="absolute top-[-2px] left-1/2 -translate-x-1/2 w-[75%] h-[25%] overflow-visible pointer-events-none z-10">
            <svg className="w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
              <path
                d="M 20 80 Q 50 10, 100 10 T 180 80"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="5"
                strokeLinecap="round"
                className="drop-shadow-md"
              />
            </svg>
          </div>
          
          {/* White Background Circle */}
          <div className="absolute inset-[10px] sm:inset-[8px] md:inset-[6px] rounded-full bg-white shadow-inner flex items-center justify-center overflow-hidden">
            {/* QR Code - Generated dynamically */}
            <div className="w-[90%] h-[90%] relative flex items-center justify-center p-2">
              <QRCode
                value={cleanUrl}
                size={180}
                level="H"
                fgColor="#1e3a8a"
                bgColor="#ffffff"
                style={{ 
                  height: '100%', 
                  width: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
                viewBox="0 0 200 200"
              />
            </div>
          </div>
        </div>
        
        {/* BRIGHT WORKS Text Below QR */}
        <div className="mt-4 sm:mt-3 md:mt-2">
          <p className="text-[#1e3a8a] font-bold text-base sm:text-sm md:text-xs uppercase tracking-[0.15em] text-center leading-tight">
            BRIGHT WORKS
          </p>
        </div>
      </div>
      
      <div className="space-y-1.5 text-center w-full max-w-[160px] sm:max-w-[140px] md:max-w-[120px]">
        <a
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] sm:text-[9px] font-semibold text-primary-300 underline-offset-4 hover:underline transition-colors"
        >
          <span>Escanear para instalar</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <p className="text-[9px] sm:text-[8px] text-slate-500 break-all px-1">
          {cleanUrl.replace(/^https?:\/\//, '')}
        </p>
        
        {/* Instructions Toggle */}
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center justify-center gap-1 text-[10px] sm:text-[9px] font-medium text-primary-400 hover:text-primary-300 transition-colors w-full touch-manipulation"
        >
          <span>Instrucciones</span>
          {showInstructions ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {/* Instructions */}
        {showInstructions && (
          <div className="mt-2 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
            {platform === 'ios' && iOSInstructions}
            {platform === 'android' && browser === 'chrome' && AndroidChromeInstructions}
            {platform === 'android' && browser === 'firefox' && AndroidFirefoxInstructions}
            {platform === 'android' && browser !== 'chrome' && browser !== 'firefox' && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                <p className="text-xs font-semibold text-white">Usa {browser}</p>
                <p className="text-[10px] text-amber-200/80 mt-0.5">
                  Menú → "Instalar" o "Añadir a la pantalla de inicio"
                </p>
              </div>
            )}
            {browserOptions}
          </div>
        )}
      </div>
    </div>
  )
}
