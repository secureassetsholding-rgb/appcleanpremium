import { SidebarHeader } from './SidebarHeader'
import { SidebarNav } from './SidebarNav'
import { SidebarFooter } from './SidebarFooter'
import { SidebarProps } from './types'

export function Sidebar({ user, profileAvatar, onLogout, onNavigate }: SidebarProps) {
  return (
    <div
      className="flex h-full flex-col overflow-y-auto overscroll-contain border-r border-slate-800 bg-slate-900/90"
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
