import { Link, useLocation } from 'react-router-dom'
import { LucideIcon } from 'lucide-react'
import { navigationItems } from './navConfig'
import { User } from './types'

interface SidebarNavProps {
  user: User | null
  onNavigate?: () => void  // ✅ Nueva prop
}

interface NavItemProps {
  name: string
  href: string
  icon: LucideIcon
  color: string
  isActive: boolean
  onClick?: () => void
}

function NavItem({ name, href, icon: Icon, color, isActive, onClick }: NavItemProps) {
  return (
    <Link
      to={href}
      onClick={onClick}  // Closes menu on mobile
      className={`
        group flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium
        transition-all duration-200 sm:gap-2.5 sm:px-3 sm:py-3 md:gap-3 md:px-4
        ${
          isActive
            ? `bg-gradient-to-r ${color} text-white shadow-lg`
            : 'text-slate-300 hover:bg-slate-800 hover:text-white active:bg-slate-700'
        }
      `}
    >
      <Icon
        className={`h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5 ${
          isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
        }`}
      />
      <span className="truncate">{name}</span>
    </Link>
  )
}

export function SidebarNav({ user, onNavigate }: SidebarNavProps) {
  const location = useLocation()

  const filteredNav = navigationItems.filter((item) => {
    // If no user, show nothing
    if (!user) return false
    
    // Superadmins and admins always have access to everything
    if (user.role === 'superadmin' || user.role === 'admin') return true
    
    // For employees, check specific permission
    if (item.permission) {
      const userPermissions = user.permissions || []
      return userPermissions.includes(item.permission)
    }
    
    // If no permission defined, check by role
    return item.roles.includes(user.role)
  })

  return (
    <nav
      className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-3 md:px-4"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {filteredNav.map((item) => (
        <NavItem
          key={item.href}
          name={item.name}
          href={item.href}
          icon={item.icon}
          color={item.color}
          isActive={location.pathname === item.href}
          onClick={onNavigate}  // Pass close function
        />
      ))}
    </nav>
  )
}
