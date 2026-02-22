import { LucideIcon } from 'lucide-react'
import { Permission, User as MainUser } from '../../../types'

export type UserRole = 'superadmin' | 'admin' | 'employee'

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  roles: UserRole[]
  permission?: Permission // Permiso requerido para acceder
  color: string
}

// Compatible con el User principal del sistema
export type User = Omit<MainUser, '_id'> & {
  _id?: string
  id?: string
  avatar?: string
}

export interface SidebarProps {
  user: User | null
  profileAvatar?: string
  onLogout: () => void
  onNavigate?: () => void
}
