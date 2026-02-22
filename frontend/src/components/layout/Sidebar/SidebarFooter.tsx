import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { User as UserIcon, LogOut, Smartphone, ChevronDown, ChevronUp } from 'lucide-react'
import QRCode from 'react-qr-code'
import { User } from './types'

interface SidebarFooterProps {
  user: User | null
  profileAvatar?: string
  onLogout: () => void
  onNavigate?: () => void
}

export function SidebarFooter({ user, profileAvatar, onLogout, onNavigate }: SidebarFooterProps) {
  const year = new Date().getFullYear()
  const userInitial = user?.fullName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brightworks.app'
  
  const [showInstructions, setShowInstructions] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop')
  const [browser, setBrowser] = useState<'safari' | 'chrome' | 'firefox' | 'edge' | 'other'>('other')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = navigator.userAgent.toLowerCase()
    
    // Detect platform
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios')
    } else if (/android/.test(ua)) {
      setPlatform('android')
    } else {
      setPlatform('desktop')
    }
    
    // Detect browser
    if (/safari/.test(ua) && !/chrome|chromium|edg/.test(ua)) {
      setBrowser('safari')
    } else if (/chrome/.test(ua) && !/edg/.test(ua)) {
      setBrowser('chrome')
    } else if (/firefox/.test(ua)) {
      setBrowser('firefox')
    } else if (/edg/.test(ua)) {
      setBrowser('edge')
    }
  }, [])

  const handleLogout = () => {
    onNavigate?.()
    onLogout()
  }

  const getInstallInstructions = () => {
    if (platform === 'ios') {
      return (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold text-blue-300 uppercase tracking-wide">iOS Safari</p>
          <div className="text-[9px] text-slate-300 space-y-1">
            <p>1. Tap the <span className="font-semibold">Share</span> button ↑</p>
            <p>2. Select <span className="font-semibold">"Add to Home Screen"</span></p>
            <p>3. Tap <span className="font-semibold">"Add"</span></p>
          </div>
        </div>
      )
    }
    
    if (platform === 'android') {
      if (browser === 'chrome') {
        return (
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold text-green-300 uppercase tracking-wide">Android Chrome</p>
            <div className="text-[9px] text-slate-300 space-y-1">
              <p>1. Tap menu <span className="font-semibold">⋮</span> (top right)</p>
              <p>2. Select <span className="font-semibold">"Install app"</span></p>
              <p>3. Tap <span className="font-semibold">"Install"</span></p>
            </div>
          </div>
        )
      }
      if (browser === 'firefox') {
        return (
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold text-orange-300 uppercase tracking-wide">Android Firefox</p>
            <div className="text-[9px] text-slate-300 space-y-1">
              <p>1. Tap menu <span className="font-semibold">☰</span></p>
              <p>2. Select <span className="font-semibold">"Install"</span></p>
              <p>3. Confirm installation</p>
            </div>
          </div>
        )
      }
      return (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold text-green-300 uppercase tracking-wide">Android</p>
          <div className="text-[9px] text-slate-300 space-y-1">
            <p>1. Open browser menu</p>
            <p>2. Select <span className="font-semibold">"Add to Home Screen"</span></p>
            <p>3. Confirm</p>
          </div>
        </div>
      )
    }
    
    // Desktop
    if (browser === 'chrome') {
      return (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold text-green-300 uppercase tracking-wide">Chrome Desktop</p>
          <div className="text-[9px] text-slate-300 space-y-1">
            <p>1. Click install icon in address bar</p>
            <p>2. Or: Menu → <span className="font-semibold">"Install Bright Works"</span></p>
          </div>
        </div>
      )
    }
    if (browser === 'edge') {
      return (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold text-blue-300 uppercase tracking-wide">Edge Desktop</p>
          <div className="text-[9px] text-slate-300 space-y-1">
            <p>1. Click <span className="font-semibold">⊕</span> in address bar</p>
            <p>2. Or: Menu → Apps → <span className="font-semibold">"Install"</span></p>
          </div>
        </div>
      )
    }
    
    return (
      <div className="space-y-1.5">
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">Desktop Browser</p>
        <div className="text-[9px] text-slate-300 space-y-1">
          <p>Look for install icon in address bar</p>
          <p>Or check browser menu for "Install"</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-slate-800 px-2 py-3 sm:px-3 sm:py-4">
      <div className="space-y-3">
        
        {/* QR Code with Install Instructions */}
        <div className="rounded-xl border border-primary-500/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-[9px] font-semibold uppercase tracking-wide text-primary-300">Install App</span>
            </div>
            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex items-center gap-0.5 text-[8px] text-slate-400 hover:text-white transition-colors"
            >
              <span>How to</span>
              {showInstructions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
          
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="rounded-lg bg-white p-2 shadow-lg">
              <QRCode
                value={appUrl}
                size={72}
                level="M"
                fgColor="#1e3a8a"
                bgColor="#ffffff"
              />
            </div>
          </div>
          
          <p className="mt-2 text-center text-[8px] text-slate-500">
            Scan to install on mobile
          </p>
          
          {/* Install Instructions */}
          {showInstructions && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              {getInstallInstructions()}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            <Link
              to="/settings"
              onClick={onNavigate}
              className="relative block h-8 w-8 overflow-hidden rounded-full border border-primary-500/40 bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg"
            >
              {profileAvatar ? (
                <img
                  src={profileAvatar}
                  alt="Profile"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-semibold">
                  {userInitial}
                </span>
              )}
            </Link>
          </div>

          <div className="min-w-0 flex-1">
            <Link to="/settings" onClick={onNavigate} className="block">
              <p className="truncate text-xs font-semibold text-white hover:text-primary-300 transition-colors">
                {user?.fullName || user?.username || 'Team member'}
              </p>
              <p className="truncate text-[10px] uppercase tracking-wide text-slate-400">
                {user?.role || 'Employee'}
              </p>
            </Link>
          </div>

          <div className="flex flex-shrink-0 gap-1">
            <Link
              to="/settings"
              onClick={onNavigate}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-primary-200 active:bg-slate-700 transition-colors"
              title="Settings"
            >
              <UserIcon className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-red-300 active:bg-slate-700 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Copyright */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-center text-[9px] leading-snug text-slate-500">
          <p className="font-semibold text-slate-300">Bright Works</p>
          <p>© {year} LELC & JTH Technology</p>
        </div>
      </div>
    </div>
  )
}
