import { ChangeEvent, ComponentType, FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users as UsersIcon,
  UserPlus,
  Shield,
  User,
  Trash2,
  Edit2,
  Save,
  X,
  Search,
  Mail,
  Loader2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { apiClient } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { User as UserRecord, Permission } from '../types'

type Role = UserRecord['role']

type FormState = {
  username: string
  email: string
  fullName: string
  password: string
  role: Role
  permissions: Permission[]
}

type FormMode = 'create' | 'edit'

const allPermissions: Permission[] = [
  'schedule',
  'daily_report',
  'dashboard',
  'calendar',
  'notes',
  'reminders',
  'expenses',
  'quotes',
  'clients',
  'users',
  'settings',
]

const permissionLabels: Record<Permission, string> = {
  schedule: 'Schedule (Task Table)',
  daily_report: 'Daily Report',
  dashboard: 'Dashboard',
  calendar: 'Calendar',
  notes: 'Notes',
  reminders: 'Reminders',
  expenses: 'Expenses',
  quotes: 'Quotes',
  clients: 'Clients',
  users: 'Users Management',
  settings: 'Settings',
}

const emptyForm: FormState = {
  username: '',
  email: '',
  fullName: '',
  password: '',
  role: 'employee',
  permissions: ['schedule', 'daily_report'],
}

function sanitizeFormValue(value: string) {
  return value.replace(/\s+/g, ' ').trimStart()
}

function formatDate(value: string) {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

function RoleBadge({ role }: { role: Role }) {
  const isSuperAdmin = role === 'superadmin'
  const isAdmin = role === 'admin'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-xs font-semibold ${
        isSuperAdmin
          ? 'border-purple-500/60 bg-purple-500/10 text-purple-300'
          : isAdmin
          ? 'border-green-500/60 bg-green-500/10 text-green-300'
          : 'border-blue-500/60 bg-blue-500/10 text-blue-300'
      }`}
    >
      {isSuperAdmin ? <ShieldCheck className="h-3 w-3" /> : isAdmin ? <Shield className="h-3 w-3" /> : <UsersIcon className="h-3 w-3" />}
      {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Employee'}
    </span>
  )
}

function MetricCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: ComponentType<{ className?: string }>; accent: 'primary' | 'green' | 'blue' }) {
  const accentClasses: Record<typeof accent, string> = {
    primary: 'border-primary-500/30 bg-primary-500/10 text-primary-200',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    blue: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-900/20">
      <div className="flex items-center gap-4">
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${accentClasses[accent]}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">{label}</p>
          <p className="text-2xl font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-8 py-16 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300">
        <UsersIcon className="h-7 w-7" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-xl border border-primary-500/40 bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
        >
          <UserPlus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<UserRecord[]>('/api/users')
        if (!Array.isArray(response)) return []
        return response
      } catch (error) {
        console.error('Error fetching users', error)
        throw error
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  })

  const [search, setSearch] = useState('')
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [formVisible, setFormVisible] = useState(false)

  const isSuperAdmin = currentUser?.role === 'superadmin'
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin
  const canManageUsers = isAdmin
  
  // Solo superadmin puede modificar roles y passwords de admins
  const canModifyAdminRoles = isSuperAdmin

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return []
    if (!search) return users
    const normalized = search.toLowerCase().trim()
    return users.filter((entry) => {
      if (!entry) return false
      const haystack = [entry.username, entry.email, entry.fullName ?? ''].map((value) => value.toLowerCase())
      return haystack.some((value) => value.includes(normalized))
    })
  }, [users, search])

  const stats = useMemo(() => {
    if (!Array.isArray(users)) return { total: 0, superadmin: 0, admin: 0, employee: 0 }
    const superadmin = users.filter((user) => user && user.role === 'superadmin').length
    const admin = users.filter((user) => user && user.role === 'admin').length
    const employee = users.filter((user) => user && user.role === 'employee').length
    return {
      total: users.length,
      superadmin,
      admin,
      employee,
    }
  }, [users])

  const resetForm = () => {
    setFormState(emptyForm)
    setActiveUserId(null)
    setFormMode('create')
  }

  const openCreateForm = () => {
    resetForm()
    setFormVisible(true)
  }

  const openEditForm = (user: UserRecord) => {
    setFormState({
      username: user.username,
      email: user.email,
      fullName: user.fullName ?? '',
      password: '',
      role: user.role,
      permissions: user.permissions || (
        user.role === 'superadmin' || user.role === 'admin' 
          ? allPermissions 
          : ['schedule', 'daily_report']
      ),
    })
    setActiveUserId(user._id)
    setFormMode('edit')
    setFormVisible(true)
  }
  
  // Verificar si el usuario a editar es admin/superadmin y si puede ser modificado
  const editingUser = users.find(u => u._id === activeUserId)
  const isEditingAdmin = editingUser && (editingUser.role === 'admin' || editingUser.role === 'superadmin')
  void (canModifyAdminRoles && isEditingAdmin)

  const closeForm = () => {
    setFormVisible(false)
    resetForm()
  }

  const createMutation = useMutation({
    mutationFn: (payload: FormState) => apiClient.post<UserRecord>('/api/users', payload),
    onSuccess: () => {
      toast.success('User created successfully', { icon: '✅' })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeForm()
    },
    onError: (error: unknown) => {
      console.error('Create user failed', error)
      toast.error('Unable to create user right now', { icon: '❌' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<FormState> }) =>
      apiClient.put<UserRecord>(`/api/users/${id}`, payload),
    onSuccess: (updatedUser) => {
      console.log('User update response:', updatedUser)
      toast.success('User updated successfully', { icon: '✅' })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeForm()
      
      // Si se actualizó el usuario actual y cambió el rol, mostrar mensaje
      if (currentUser && currentUser._id === updatedUser._id && currentUser.role !== updatedUser.role) {
        toast.success('Your role has been updated. Please log out and log in again to see the changes.', { 
          icon: '⚠️',
          duration: 5000 
        })
      }
    },
    onError: (error: unknown) => {
      console.error('Update user failed', error)
      toast.error('Unable to update user right now', { icon: '❌' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/users/${id}`),
    onSuccess: () => {
      toast.success('User removed', { icon: '🗑️' })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: unknown) => {
      console.error('Delete user failed', error)
      toast.error('Unable to delete user right now', { icon: '❌' })
    },
  })

  const formIsSubmitting = createMutation.isPending || updateMutation.isPending

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    
    // Si intenta cambiar el role de un admin y no tiene permisos, bloquear
    if (name === 'role' && isEditingAdmin && !canModifyAdminRoles) {
      toast.error('Only Super Admin can modify roles of admin users', { icon: '⚠️' })
      return
    }
    
    setFormState((prev) => {
      if (name === 'role') {
        const newRole = value as Role
        // Si cambia a employee, reset permisos a solo schedule y daily_report
        // Si cambia a admin o superadmin, dar todos los permisos
        return {
          ...prev,
          role: newRole,
          permissions: (newRole === 'admin' || newRole === 'superadmin') 
            ? allPermissions 
            : ['schedule', 'daily_report'],
        }
      }
      return {
        ...prev,
        [name]: sanitizeFormValue(value),
      }
    })
  }

  const handlePermissionToggle = (permission: Permission) => {
    setFormState((prev) => {
      // Admins siempre tienen todos los permisos
      if (prev.role === 'admin') return prev
      
      const current = prev.permissions || []
      const isSelected = current.includes(permission)
      return {
        ...prev,
        permissions: isSelected ? current.filter((p) => p !== permission) : [...current, permission],
      }
    })
  }

  const validateForm = (): string | null => {
    if (!formState.username.trim()) return 'Username is required'
    if (!formState.email.trim()) return 'Email is required'
    const emailPattern = /.+@.+\..+/
    if (!emailPattern.test(formState.email)) return 'Enter a valid email address'
    if (formMode === 'create' && !formState.password) return 'Password is required for new users'
    if (formState.password && formState.password.length < 6) return 'Password must be at least 6 characters'
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError, { icon: '⚠️' })
      return
    }

    if (formMode === 'create') {
      // Solo superadmin puede crear admins
      if ((formState.role === 'admin' || formState.role === 'superadmin') && !canModifyAdminRoles) {
        toast.error('Only Super Admin can create admin users', { icon: '⚠️' })
        return
      }
      
      // Para employees, asegurar que siempre tengan schedule y daily_report
      const finalPermissions: Permission[] = (formState.role === 'admin' || formState.role === 'superadmin')
        ? allPermissions 
        : [...new Set([...formState.permissions, 'schedule' as Permission, 'daily_report' as Permission])]
      
      createMutation.mutate({ ...formState, permissions: finalPermissions })
    } else if (activeUserId) {
      // Verificar permisos para modificar roles/passwords de admins
      if (isEditingAdmin && !canModifyAdminRoles) {
        if (formState.role !== editingUser?.role) {
          toast.error('Only Super Admin can modify roles of admin users', { icon: '⚠️' })
          return
        }
        if (formState.password) {
          toast.error('Only Super Admin can modify passwords of admin users', { icon: '⚠️' })
          return
        }
      }
      
      // Solo superadmin puede asignar roles de admin/superadmin
      if ((formState.role === 'admin' || formState.role === 'superadmin') && !canModifyAdminRoles) {
        toast.error('Only Super Admin can assign admin or superadmin roles', { icon: '⚠️' })
        return
      }
      
      // Para employees, asegurar que siempre tengan schedule y daily_report
      const finalPermissions: Permission[] = (formState.role === 'admin' || formState.role === 'superadmin')
        ? allPermissions 
        : [...new Set([...formState.permissions, 'schedule' as Permission, 'daily_report' as Permission])]
      
      const payload: Partial<FormState> = {
        username: formState.username,
        email: formState.email,
        fullName: formState.fullName,
        role: formState.role,
        permissions: finalPermissions,
      }
      if (formState.password) {
        payload.password = formState.password
      }
      updateMutation.mutate({ id: activeUserId, payload })
    }
  }

  const confirmDelete = (user: UserRecord) => {
    if (!canManageUsers) return
    if (currentUser && currentUser._id === user._id) {
      toast.error("You can't delete your own account", { icon: '⚠️' })
      return
    }
    const confirmed = window.confirm(`Delete user “${user.username}”? This action cannot be undone.`)
    if (confirmed) {
      deleteMutation.mutate(user._id)
    }
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading users…
        </div>
      )
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-10 text-center text-red-200">
          <AlertTriangle className="h-8 w-8" />
          <p className="text-sm">We couldn’t load the user list. Please verify the backend or retry.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-600/20 px-4 py-2 text-sm font-semibold hover:bg-red-600/30"
          >
            Retry
          </button>
        </div>
      )
    }

    if (filteredUsers.length === 0) {
      return (
        <EmptyState
          title={search ? 'No users match your search' : 'No team members yet'}
          description={
            search
              ? 'Try a different keyword or clear the search box.'
              : 'Create users to start assigning workspaces, schedules, and permissions.'
          }
          actionLabel={canManageUsers ? 'Create user' : undefined}
          onAction={canManageUsers ? openCreateForm : undefined}
        />
      )
    }

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-slate-900/20">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">User</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Role</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Permissions</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Created</th>
                {canManageUsers && (
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredUsers.map((user) => (
                <tr key={user._id} className="transition hover:bg-slate-800/40">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary-500/40 bg-primary-500/10 text-base font-semibold text-primary-200">
                        {(user.fullName ?? user.username)[0]?.toUpperCase() ?? 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{user.fullName || user.username}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="h-4 w-4" />
                      <span className="break-words">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-200">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                      {user.role === 'superadmin' || user.role === 'admin' ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                          user.role === 'superadmin'
                            ? 'border-purple-500/60 bg-purple-500/10 text-purple-300'
                            : 'border-green-500/60 bg-green-500/10 text-green-300'
                        }`}>
                          All Access
                        </span>
                      ) : (
                        (user.permissions || ['schedule', 'daily_report']).map((perm) => (
                          <span
                            key={perm}
                            className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300"
                            title={permissionLabels[perm as Permission]}
                          >
                            {permissionLabels[perm as Permission]?.split(' ')[0] || perm}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">{formatDate(user.createdAt)}</td>
                  {canManageUsers && (
                    <td className="px-6 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEditForm(user)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-primary-300"
                          title="Edit user"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => confirmDelete(user)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/40 bg-red-600/10 text-red-300 transition hover:bg-red-600/20"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <UsersIcon className="h-8 w-8 text-primary-400" />
            Team directory
          </h1>
          <p className="text-sm text-slate-400">
            Manage access, roles, and onboarding for Bright Works operators. Changes sync with the backend instantly.
          </p>
        </div>
        {canManageUsers && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-xl border border-primary-500/40 bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
            >
              <UserPlus className="h-4 w-4" />
              Create user
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Total users" value={stats.total} icon={UsersIcon} accent="primary" />
        <MetricCard label="Admins" value={stats.admin} icon={ShieldCheck} accent="green" />
        <MetricCard label="Employees" value={stats.employee} icon={User} accent="blue" />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-900/20">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, username, or email…"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-12 pr-4 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </div>

      {renderContent()}

      {formVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={formIsSubmitting ? undefined : closeForm} />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  {formMode === 'create' ? 'Create user' : 'Edit user'}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {formMode === 'create'
                    ? 'Invite a new member to the Bright Works platform. They will receive their credentials instantly.'
                    : 'Update user details, adjust their role, or reset credentials.'}
                </p>
              </div>
              <button
                onClick={closeForm}
                disabled={formIsSubmitting}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition hover:text-white disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Username *</span>
                  <input
                    name="username"
                    value={formState.username}
                    onChange={handleInputChange}
                    autoFocus
                    maxLength={40}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    placeholder="janedoe"
                    required
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Email *</span>
                  <input
                    name="email"
                    value={formState.email}
                    onChange={handleInputChange}
                    type="email"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    placeholder="name@brightworks.com"
                    required
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-300">Full name</span>
                <input
                  name="fullName"
                  value={formState.fullName}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Jane Doe"
                />
              </label>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                    Password
                    {formMode === 'create' && <span className="rounded-full bg-primary-500/20 px-2 py-[1px] text-xs text-primary-200">required</span>}
                    {formMode === 'edit' && <span className="text-xs lowercase text-slate-500">leave blank to keep current password</span>}
                  </span>
                  <input
                    name="password"
                    value={formState.password}
                    onChange={handleInputChange}
                    type="password"
                    autoComplete="new-password"
                    minLength={formMode === 'create' ? 6 : 0}
                    disabled={formMode === 'edit' && isEditingAdmin && !canModifyAdminRoles}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={formMode === 'create' ? 'Minimum 6 characters' : 'Optional'}
                    required={formMode === 'create'}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Role</span>
                  <select
                    name="role"
                    value={formState.role}
                    onChange={handleInputChange}
                    disabled={formMode === 'edit' && isEditingAdmin && !canModifyAdminRoles}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="employee">Employee</option>
                    {canModifyAdminRoles && <option value="admin">Admin</option>}
                    {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                  </select>
                  {formMode === 'edit' && isEditingAdmin && !canModifyAdminRoles && (
                    <p className="mt-1 text-xs text-amber-400">
                      Only Super Admin can modify roles of admin users
                    </p>
                  )}
                </label>
              </div>

              {formState.role === 'employee' && (
                <label className="space-y-3">
                  <div>
                    <span className="text-sm font-semibold text-slate-300">App Access Permissions</span>
                    <p className="mt-1 text-xs text-slate-500">
                      Select which sections of the app this employee can access. Schedule and Daily Report are always included.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-700 bg-slate-800 p-4 sm:grid-cols-2">
                    {allPermissions
                      .filter((p) => p !== 'schedule' && p !== 'daily_report')
                      .map((permission) => {
                        const isSelected = formState.permissions?.includes(permission) ?? false
                        return (
                          <label
                            key={permission}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                              isSelected
                                ? 'border-primary-500/60 bg-primary-500/10'
                                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handlePermissionToggle(permission)}
                              className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-2 focus:ring-primary-500/20"
                            />
                            <span className="text-sm text-slate-200">{permissionLabels[permission]}</span>
                          </label>
                        )
                      })}
                  </div>
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2">
                    <p className="text-xs text-blue-200">
                      <strong>Always included:</strong> Schedule (Task Table), Daily Report
                    </p>
                  </div>
                </label>
              )}

              {formState.role === 'admin' && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                  <p className="text-xs text-green-200">
                    <strong>Admin users</strong> have full access to all sections of the app automatically.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={formIsSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formIsSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-500/40 bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed"
                >
                  {formIsSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {formMode === 'create' ? 'Create user' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
