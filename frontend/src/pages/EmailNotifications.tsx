import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Save, Loader2, ShieldCheck, CheckCircle2, AlertCircle, Bell, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { User } from '../types'

interface EmailNotificationConfig {
  sectionCompletion: {
    enabled: boolean
    enabledAdmins: User[]
    allAdmins: User[]
  }
  dayCompletion: {
    enabled: boolean
    enabledAdmins: User[]
    allAdmins: User[]
  }
}

export default function EmailNotifications() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [sectionEnabled, setSectionEnabled] = useState(true)
  const [dayEnabled, setDayEnabled] = useState(true)
  const [selectedSectionAdmins, setSelectedSectionAdmins] = useState<string[]>([])
  const [selectedDayAdmins, setSelectedDayAdmins] = useState<string[]>([])

  const isSuperAdmin = user?.role === 'superadmin'

  const { data: config, isLoading, isError } = useQuery<EmailNotificationConfig>({
    queryKey: ['email-notifications'],
    queryFn: async () => {
      const response = await api.get<EmailNotificationConfig>('/api/email-notifications')
      return response
    },
    enabled: isSuperAdmin,
  })

  // Show access denied message if user is not superadmin
  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-amber-400 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Restricted</h2>
          <p className="text-slate-300 mb-4">
            This page is only accessible to Super Administrators.
          </p>
          <p className="text-sm text-slate-400 mb-6">
            To gain access, you need to have the <strong className="text-amber-400">superadmin</strong> role assigned to your account.
            <br /><br />
            If you have another superadmin account, log in with that account and edit your user profile to assign the superadmin role.
            <br /><br />
            Default superadmin credentials:
            <br />
            <code className="bg-slate-800 px-2 py-1 rounded text-sm">Username: superadmin</code>
            <br />
            <code className="bg-slate-800 px-2 py-1 rounded text-sm">Password: superadmin123</code>
          </p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (config) {
      setSectionEnabled(config.sectionCompletion?.enabled ?? true)
      setDayEnabled(config.dayCompletion?.enabled ?? true)
      setSelectedSectionAdmins((config.sectionCompletion?.enabledAdmins || []).map(a => a._id))
      setSelectedDayAdmins((config.dayCompletion?.enabledAdmins || []).map(a => a._id))
    }
  }, [config])

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      sectionCompletion?: { enabled: boolean; enabledAdmins: string[] }
      dayCompletion?: { enabled: boolean; enabledAdmins: string[] }
    }) => {
      return api.put('/api/email-notifications', payload)
    },
    onSuccess: () => {
      toast.success('Email notification settings saved', { icon: '✅' })
      queryClient.invalidateQueries({ queryKey: ['email-notifications'] })
    },
    onError: (error: unknown) => {
      console.error('Update email notifications failed', error)
      toast.error('Failed to save settings', { icon: '❌' })
    },
  })

  const handleToggleSection = (adminId: string) => {
    setSelectedSectionAdmins(prev => {
      if (prev.includes(adminId)) {
        return prev.filter(id => id !== adminId)
      }
      return [...prev, adminId]
    })
  }

  const handleToggleDay = (adminId: string) => {
    setSelectedDayAdmins(prev => {
      if (prev.includes(adminId)) {
        return prev.filter(id => id !== adminId)
      }
      return [...prev, adminId]
    })
  }

  const handleSelectAllSection = () => {
    if (!config?.sectionCompletion?.allAdmins || !Array.isArray(config.sectionCompletion.allAdmins)) return
    if (selectedSectionAdmins.length === config.sectionCompletion.allAdmins.length) {
      setSelectedSectionAdmins([])
    } else {
      setSelectedSectionAdmins(config.sectionCompletion.allAdmins.map((a) => a._id))
    }
  }

  const handleSelectAllDay = () => {
    if (!config?.dayCompletion?.allAdmins || !Array.isArray(config.dayCompletion.allAdmins)) return
    if (selectedDayAdmins.length === config.dayCompletion.allAdmins.length) {
      setSelectedDayAdmins([])
    } else {
      setSelectedDayAdmins(config.dayCompletion.allAdmins.map((a) => a._id))
    }
  }

  const handleSave = () => {
    if (!config) return

    updateMutation.mutate({
      sectionCompletion: {
        enabled: sectionEnabled,
        enabledAdmins: selectedSectionAdmins,
      },
      dayCompletion: {
        enabled: dayEnabled,
        enabledAdmins: selectedDayAdmins,
      },
    })
  }

  // Verificar que solo superadmin puede acceder
  if (user?.role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">Only Super Admin can access email notification settings.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading email notification settings…
      </div>
    )
  }

  if (isError || !config) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-10 text-center text-red-200">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">We couldn't load the email notification settings. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <header className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 shadow-lg shadow-slate-950/40 sm:rounded-2xl sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-7">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
          <div>
            <h1 className="flex items-center gap-1.5 text-lg font-semibold text-white sm:gap-2 sm:text-xl md:text-2xl lg:text-3xl">
              <Mail className="h-5 w-5 text-primary-300 sm:h-6 sm:w-6 md:h-7 md:w-7" />
              Email Notifications
            </h1>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              Configure which administrators receive automatic email notifications
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation active:scale-95"
            style={{ minHeight: '44px' }}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Save Settings</span>
            <span className="sm:hidden">Save</span>
          </button>
        </div>
      </header>

      <div className="space-y-6">
        {/* Section Completion Notifications */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40 sm:p-6 md:p-7">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-purple-500/10 p-3">
                <CheckCircle2 className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white sm:text-xl">Section Completion Emails</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Send emails when a task section (group) is completed by an employee
                </p>
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={sectionEnabled}
                onChange={(e) => setSectionEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/20"></div>
            </label>
          </div>

          {sectionEnabled && (
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-800/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-300">Select Administrators</p>
                <button
                  onClick={handleSelectAllSection}
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  {config.sectionCompletion?.allAdmins && Array.isArray(config.sectionCompletion.allAdmins) && selectedSectionAdmins.length === config.sectionCompletion.allAdmins.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(config.sectionCompletion?.allAdmins || []).map((admin) => {
                  const isSelected = selectedSectionAdmins.includes(admin._id)
                  return (
                    <label
                      key={admin._id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                        isSelected
                          ? 'border-purple-500/60 bg-purple-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSection(admin._id)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-2 focus:ring-purple-500/20"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{admin.fullName || admin.username}</p>
                        <p className="text-xs text-slate-400">{admin.email}</p>
                      </div>
                      {admin.role === 'superadmin' && (
                        <ShieldCheck className="h-4 w-4 text-purple-400" />
                      )}
                    </label>
                  )
                })}
              </div>
              {selectedSectionAdmins.length === 0 && (
                <p className="text-xs text-amber-400">⚠️ No administrators selected. No emails will be sent.</p>
              )}
            </div>
          )}
        </div>

        {/* Day Completion Notifications */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40 sm:p-6 md:p-7">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-3">
                <FileText className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white sm:text-xl">Daily Report Emails</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Send emails when an employee signs digitally (completes their workday)
                </p>
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={dayEnabled}
                onChange={(e) => setDayEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/20"></div>
            </label>
          </div>

          {dayEnabled && (
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-800/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-300">Select Administrators</p>
                <button
                  onClick={handleSelectAllDay}
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  {config.dayCompletion?.allAdmins && Array.isArray(config.dayCompletion.allAdmins) && selectedDayAdmins.length === config.dayCompletion.allAdmins.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(config.dayCompletion?.allAdmins || []).map((admin) => {
                  const isSelected = selectedDayAdmins.includes(admin._id)
                  return (
                    <label
                      key={admin._id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                        isSelected
                          ? 'border-emerald-500/60 bg-emerald-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleDay(admin._id)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{admin.fullName || admin.username}</p>
                        <p className="text-xs text-slate-400">{admin.email}</p>
                      </div>
                      {admin.role === 'superadmin' && (
                        <ShieldCheck className="h-4 w-4 text-purple-400" />
                      )}
                    </label>
                  )
                })}
              </div>
              {selectedDayAdmins.length === 0 && (
                <p className="text-xs text-amber-400">⚠️ No administrators selected. No emails will be sent.</p>
              )}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-blue-200">
              <p className="font-semibold">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-blue-200/80 ml-2">
                <li><strong>Section Completion:</strong> Sent automatically when an employee completes all tasks in a section (e.g., "Cleaning Task 1", "Refill", etc.)</li>
                <li><strong>Daily Report:</strong> Sent automatically when an employee digitally signs at the end of their workday</li>
                <li>Each email type can be enabled/disabled independently</li>
                <li>You can select specific administrators to receive each type of notification</li>
                <li>Changes take effect immediately after saving</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



