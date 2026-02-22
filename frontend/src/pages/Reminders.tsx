import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, BellRing, Plus, Edit2, Trash2, Calendar as CalendarIcon, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiClient } from '../services/api'
import { Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { AICopilotCard } from '../components/AICopilotCard'

interface Reminder {
  _id: string
  title: string
  description?: string
  dueDate: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
}

const PRIORITY_LABELS: Record<Reminder['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export default function Reminders() {
  const [search, setSearch] = useState('')
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [showForm, setShowForm] = useState(false)
  const toLocalInputValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
  }

  const composeISOFromInput = (value: string) => {
    if (!value) return null
    const local = new Date(value)
    if (Number.isNaN(local.getTime())) return null
    return local.toISOString()
  }

  const formatDueLabel = (isoString: string) => {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return 'No date'
    return date.toLocaleString([], {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const todayWindow = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start: start.getTime(), end: end.getTime() }
  }, [])

  const nowDate = new Date()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueAt: toLocalInputValue(nowDate),
    priority: 'medium' as Reminder['priority'],
  })
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all')
  const queryClient = useQueryClient()

  const { data: remindersRaw = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<Reminder[]>('/api/reminders')
        return Array.isArray(result) ? result : []
      } catch {
        return []
      }
    },
  })

  const reminders = useMemo(() => {
    if (!Array.isArray(remindersRaw)) return []
    return remindersRaw.filter((reminder): reminder is Reminder => Boolean(reminder))
  }, [remindersRaw])

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<Reminder, '_id' | 'completed'>) =>
      apiClient.post<Reminder>('/api/reminders', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Reminder created', { icon: '🔔' })
      closeForm()
    },
    onError: () => toast.error('Unable to create reminder', { icon: '❌' }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Reminder> }) =>
      apiClient.put<Reminder>(`/api/reminders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Reminder updated', { icon: '💾' })
      closeForm()
    },
    onError: () => toast.error('Unable to update reminder', { icon: '❌' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/reminders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Reminder removed', { icon: '🗑️' })
    },
    onError: () => toast.error('Unable to delete reminder', { icon: '❌' }),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) =>
      apiClient.put<Reminder>(`/api/reminders/${id}`, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
    onError: () => toast.error('Unable to update status', { icon: '❌' }),
  })

  const filteredReminders = useMemo(() => {
    const needle = search.toLowerCase().trim()
    const matchesSearch = (reminder: Reminder) => {
      if (!needle) return true
      return [reminder.title, reminder.description ?? '', reminder.priority]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    }

    const now = Date.now()

    if (!Array.isArray(reminders)) return []
    return reminders
      .filter((reminder) => {
        if (!reminder) return false
        if (!matchesSearch(reminder)) return false
        const timestamp = new Date(reminder.dueDate).getTime()
        const isValidDate = !Number.isNaN(timestamp)

        switch (activeFilter) {
          case 'today':
            return isValidDate && !reminder.completed && timestamp >= todayWindow.start && timestamp < todayWindow.end
          case 'upcoming':
            return isValidDate && !reminder.completed && timestamp >= now
          case 'completed':
            return reminder.completed
          default:
            return true
        }
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }, [reminders, search, activeFilter, todayWindow])

  const remindersStats = useMemo(() => {
    const defaultStats = {
      total: 0,
      completed: 0,
      today: 0,
      nextReminder: null as { title: string; date: Date } | null,
    }
    
    if (!Array.isArray(reminders) || reminders.length === 0) {
      return defaultStats
    }

    const now = Date.now()

    const parsed = reminders
      .map((reminder) => ({
        reminder,
        date: new Date(reminder.dueDate),
      }))
      .filter(({ date }) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const upcoming = parsed.filter(({ reminder, date }) => reminder && !reminder.completed && date.getTime() >= now)
    const todayDue = parsed.filter(
      ({ reminder, date }) => reminder && !reminder.completed && date.getTime() >= todayWindow.start && date.getTime() < todayWindow.end
    )
    const nextReminder = upcoming[0]

    return {
      total: Array.isArray(reminders) ? reminders.length : 0,
      completed: Array.isArray(reminders) ? reminders.filter((reminder) => reminder && reminder.completed).length : 0,
      today: todayDue.length,
      nextReminder: nextReminder ? { title: nextReminder.reminder.title, date: nextReminder.date } : null,
    }
  }, [reminders, todayWindow])

  const reminderFilters: { key: typeof activeFilter; label: string; count: number }[] = useMemo(() => {
    if (!Array.isArray(reminders)) {
      return [
        { key: 'all' as const, label: 'All', count: 0 },
        { key: 'today' as const, label: 'Today', count: 0 },
        { key: 'upcoming' as const, label: 'Upcoming', count: 0 },
        { key: 'completed' as const, label: 'Completed', count: 0 },
      ]
    }
    return [
      { key: 'all' as const, label: 'All', count: reminders.length },
      { key: 'today' as const, label: 'Today', count: remindersStats.today },
      {
        key: 'upcoming' as const,
        label: 'Upcoming',
        count: reminders.filter((reminder) => {
          if (!reminder) return false
          const ts = new Date(reminder.dueDate).getTime()
          return !reminder.completed && !Number.isNaN(ts) && ts >= Date.now()
        }).length,
      },
      { key: 'completed' as const, label: 'Completed', count: remindersStats.completed },
    ]
  }, [reminders, remindersStats])

  const upcomingTimeline = useMemo(() => {
    if (!Array.isArray(reminders)) return []
    return reminders
      .map((reminder) => ({ reminder, date: new Date(reminder.dueDate) }))
      .filter(({ reminder, date }) => reminder && !reminder.completed && !Number.isNaN(date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8)
  }, [reminders])

  const closeForm = () => {
    setShowForm(false)
    setEditingReminder(null)
    const resetNow = new Date()
    setFormData({
      title: '',
      description: '',
      dueAt: toLocalInputValue(resetNow),
      priority: 'medium',
    })
  }

  const openNewForm = () => {
    closeForm()
    setShowForm(true)
  }

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder)
    const due = new Date(reminder.dueDate)
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      dueAt: toLocalInputValue(due),
      priority: reminder.priority,
    })
    setShowForm(true)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const isoDueDate = composeISOFromInput(formData.dueAt)
    if (!isoDueDate) {
      toast.error('Select a valid date and time')
      return
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      dueDate: isoDueDate,
      priority: formData.priority,
    }

    if (editingReminder) {
      updateMutation.mutate({ id: editingReminder._id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <header className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-950 px-8 py-10 shadow-2xl shadow-slate-950/40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/25 via-slate-950/70 to-slate-900/70" />
        <div className="pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-amber-400/30 blur-3xl" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100">
              Premium follow-up v3.1
            </span>
            <div className="space-y-3">
              <h1 className="flex items-center gap-3 text-3xl font-bold text-white sm:text-4xl">
                <BellRing className="h-9 w-9 text-amber-300" /> Executive reminders
              </h1>
              <p className="text-sm text-amber-50/80 sm:text-base">
                Automate critical alerts, monitor internal SLAs, and maintain a flawless operational agenda with a productivity-tuned premium view.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openNewForm}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/50 bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-950 shadow-xl shadow-amber-500/30 transition hover:brightness-105"
              >
                <Plus className="h-4 w-4" /> New reminder
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('today')}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                <AlarmClock className="h-4 w-4" /> Due today
              </button>
            </div>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-lg">
            <div className="rounded-2xl border border-amber-400/30 bg-slate-900/70 p-4 text-amber-50 shadow-inner shadow-amber-500/20">
              <p className="text-xs uppercase tracking-wide text-amber-100/80">Active reminders</p>
              <p className="mt-2 text-3xl font-semibold">{remindersStats.total}</p>
              <p className="mt-2 text-xs text-amber-100/70">Includes strategic and operational follow-ups.</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 p-4 text-emerald-50 shadow-inner shadow-emerald-500/20">
              <p className="text-xs uppercase tracking-wide text-emerald-100/80">Completed</p>
              <p className="mt-2 text-3xl font-semibold">{remindersStats.completed}</p>
              <p className="mt-2 text-xs text-emerald-100/70">Automatically synced with your daily reports.</p>
            </div>
            <div className="rounded-2xl border border-sky-400/30 bg-sky-500/15 p-4 text-sky-50 shadow-inner shadow-sky-500/20 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-sky-100/80">Immediate agenda</p>
              <p className="mt-2 text-3xl font-semibold">{remindersStats.today} today</p>
              <p className="mt-2 text-xs text-sky-100/70">
                {remindersStats.nextReminder
                  ? `Next: ${remindersStats.nextReminder.title} · ${remindersStats.nextReminder.date.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Nothing pending in the immediate agenda'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-amber-400/20 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <AlarmClock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, detail, or priority…"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-11 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {reminderFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={cn(
                  'flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40',
                  activeFilter === filter.key
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-100 shadow-lg shadow-amber-500/20'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-amber-200'
                )}
              >
                <span>{filter.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-[2px] text-xs text-white/80">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {upcomingTimeline.length > 0 && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-200/70">Immediate agenda</p>
              <h2 className="text-lg font-semibold text-white">Upcoming alerts</h2>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
              {upcomingTimeline.length} queued
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcomingTimeline.map(({ reminder, date }) => (
              <div
                key={reminder._id}
                className="min-w-[220px] rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-xs text-amber-50 shadow-inner shadow-amber-500/20"
              >
                <p className="text-[11px] uppercase tracking-wide text-amber-100/80">
                  {date.toLocaleDateString([], { day: '2-digit', month: 'short' })} · {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{reminder.title}</p>
                {reminder.description && (
                  <p className="mt-1 text-[11px] text-amber-100/70">{reminder.description.slice(0, 90)}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/40">
          {/* AI Copilot Card */}
          {!editingReminder && (
            <div className="mb-6">
              <AICopilotCard />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingReminder ? 'Edit reminder' : 'New reminder'}
              </h2>
              <p className="text-xs text-slate-500">Reminders sync with notifications and daily reports.</p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Title</label>
              <input
                value={formData.title}
                onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40"
                required
              />
            </div>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date & time</span>
              <input
                type="datetime-local"
                value={formData.dueAt}
                onChange={(event) => setFormData((prev) => ({ ...prev, dueAt: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40 [color-scheme:dark]"
                required
              />
            </label>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Priority</label>
              <select
                value={formData.priority}
                onChange={(event) => setFormData((prev) => ({ ...prev, priority: event.target.value as Reminder['priority'] }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</label>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40"
                placeholder="Important details, contacts, references…"
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/40 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save reminder
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 py-16 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-amber-300" /> Loading reminders…
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
            No reminders match the selected filters.
          </div>
        ) : (
          filteredReminders.map((reminder) => {
            const dueDate = new Date(reminder.dueDate)
            const priorityGradient =
              reminder.priority === 'high'
                ? 'from-rose-500/25 via-transparent to-rose-500/10'
                : reminder.priority === 'medium'
                ? 'from-amber-500/25 via-transparent to-amber-500/10'
                : 'from-emerald-500/25 via-transparent to-emerald-500/10'

            return (
              <article
                key={reminder._id}
                className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl transition duration-300 hover:-translate-y-1"
              >
                <div className={cn('absolute inset-0 opacity-0 transition group-hover:opacity-100', `bg-gradient-to-br ${priorityGradient}`)} />
                <div className="relative z-10 flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                        {dueDate.toLocaleDateString([], { day: '2-digit', month: 'short' })}
                        · {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <h3 className="text-xl font-semibold text-white">{reminder.title}</h3>
                      {reminder.description && (
                        <p className="text-sm text-slate-200/85">
                          {reminder.description.length > 180
                            ? `${reminder.description.slice(0, 180).trimEnd()}…`
                            : reminder.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleMutation.mutate({ id: reminder._id, completed: !reminder.completed })}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
                          reminder.completed
                            ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100 shadow-inner shadow-emerald-500/20'
                            : 'border-white/10 bg-white/10 text-white/80 hover:text-emerald-200'
                        )}
                      >
                        {reminder.completed ? 'OK' : '•'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(reminder)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 transition hover:text-amber-200"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(reminder._id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200/80">
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="h-3.5 w-3.5 text-amber-200" /> {formatDueLabel(reminder.dueDate)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                      {PRIORITY_LABELS[reminder.priority]}
                    </span>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}
