import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Permission } from '../types'

interface RoleGuardProps {
  allowedRoles?: Array<'superadmin' | 'admin' | 'employee'>
  requiredPermission?: Permission
  fallback?: string
  children: ReactNode
}

export function RoleGuard({ allowedRoles, requiredPermission, fallback = '/schedule', children }: RoleGuardProps) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Si es superadmin o admin, siempre tiene acceso
  if (user.role === 'superadmin' || user.role === 'admin') {
    return <>{children}</>
  }

  // Si hay un permiso requerido, verificar que el usuario lo tenga
  if (requiredPermission) {
    const userPermissions = user.permissions || []
    if (!userPermissions.includes(requiredPermission)) {
      return <Navigate to={fallback} replace />
    }
  }

  // Si hay roles permitidos, verificar el rol
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={fallback} replace />
  }

  // Ensure children is valid before rendering
  if (!children) {
    return null
  }

  return <>{children}</>
}
