import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, PanelLeftClose, PanelLeft } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../contexts/AuthContext'
import { PWAInstallPrompt } from '../PWAInstallPrompt'

export function Layout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('brightworks_sidebar_open')
    return saved !== 'false' // Default to open
  })
  
  const { user, logout } = useAuth()
  const location = useLocation()
  
  const profileAvatar = typeof window !== 'undefined' 
    ? localStorage.getItem('brightworks_user_photo') || undefined
    : undefined

  // Auto-close mobile sidebar when route changes
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  // Save desktop sidebar preference
  useEffect(() => {
    localStorage.setItem('brightworks_sidebar_open', String(desktopSidebarOpen))
  }, [desktopSidebarOpen])

  // Prevent scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileSidebarOpen])

  const toggleDesktopSidebar = () => {
    setDesktopSidebarOpen(prev => !prev)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MOBILE HEADER (only visible < 1024px) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white active:scale-95 transition-all"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="text-sm font-semibold text-white">Bright Works</span>
        <div className="w-10" />
      </header>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MOBILE BACKDROP */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MOBILE SIDEBAR (slide-in, auto-closes on navigation) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* No close button on mobile - menu closes automatically when clicking a link */}
        <Sidebar 
          user={user} 
          profileAvatar={profileAvatar}
          onLogout={logout} 
          onNavigate={() => setMobileSidebarOpen(false)}
        />
      </aside>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MAIN LAYOUT WITH COLLAPSIBLE DESKTOP SIDEBAR */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="flex">
        {/* DESKTOP SIDEBAR (collapsible) */}
        <aside 
          className={`hidden lg:block flex-shrink-0 border-r border-slate-800 transition-all duration-300 ${
            desktopSidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0'
          }`}
        >
          <div className="sticky top-0 h-screen w-64 overflow-y-auto">
            <Sidebar 
              user={user} 
              profileAvatar={profileAvatar}
              onLogout={logout} 
            />
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 min-h-screen relative">
          {/* DESKTOP SIDEBAR TOGGLE BUTTON */}
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            className="hidden lg:flex fixed left-2 top-2 z-40 h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/90 text-slate-400 hover:bg-slate-700 hover:text-white backdrop-blur-sm transition-all shadow-lg"
            aria-label={desktopSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            title={desktopSidebarOpen ? 'Hide sidebar (more space)' : 'Show sidebar'}
          >
            {desktopSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </button>

          <div className={`w-full py-3 sm:py-4 md:py-6 lg:py-8 ${!desktopSidebarOpen ? 'lg:pl-14' : ''}`}>
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-2 sm:gap-4 sm:px-3 md:gap-6 md:px-4 lg:px-6 xl:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <PWAInstallPrompt />
    </div>
  )
}
