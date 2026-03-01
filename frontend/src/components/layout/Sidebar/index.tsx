import { SidebarHeader } from './SidebarHeader'
import { SidebarNav } from './SidebarNav'
import { SidebarFooter } from './SidebarFooter'
import { SidebarProps } from './types'

export function Sidebar({ user, profileAvatar, onLogout, onNavigate }: SidebarProps) {
  return (
    <div
      className="flex h-full flex-col overflow-y-auto overscroll-contain border-r border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl shadow-black/40"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <SidebarHeader />
      <SidebarNav user={user} onNavigate={onNavigate} />
      <SidebarFooter 
        user={user} 
        profileAvatar={profileAvatar} 
        onLogout={onLogout}
        onNavigate={onNavigate}
      />
    </div>
  )
}

export * from './types'
