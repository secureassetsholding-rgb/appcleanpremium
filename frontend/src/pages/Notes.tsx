import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Search, FileText, X, Save, Sparkles, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiClient } from '../services/api'
import { aiService } from '../services/ai'
import { loadNoteSchedules, NoteScheduleMap, setNoteSchedule } from '../lib/noteSchedule'
import { cn } from '../lib/utils'
import { AICopilotCard } from '../components/AICopilotCard'

interface Note {
  _id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  userId: string
}

export default function Notes() {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [showForm, setShowForm] = useState(false)
  const toLocalInputValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
  }

  const parseLocalInputToISO = (value: string) => {
    if (!value) return null
    const local = new Date(value)
    if (Number.isNaN(local.getTime())) return null
    return local.toISOString()
  }

  const now = new Date()
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    scheduledAt: toLocalInputValue(now),
  })
  const [noteSchedules, setNoteSchedules] = useState<NoteScheduleMap>(() => loadNoteSchedules())
  const pendingScheduleRef = useRef<string | null>(null)
  const queryClient = useQueryClient()

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      try {
        return await apiClient.get<Note[]>('/api/notes')
      } catch {
        return []
      }
    },
  })

  const registerSchedule = (noteId: string, iso: string | null) => {
    setNoteSchedule(noteId, iso)
    setNoteSchedules((prev) => {
      const next = { ...prev }
      if (!iso) {
        delete next[noteId]
      } else {
        next[noteId] = iso
      }
      return next
    })
  }

  const resetFormData = () => {
    const resetNow = new Date()
    setFormData({
      title: '',
      content: '',
      scheduledAt: toLocalInputValue(resetNow),
    })
  }

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string }) => apiClient.post<Note>('/api/notes', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Note created', { icon: '📝' })
      if (data?._id && pendingScheduleRef.current) {
        registerSchedule(data._id, pendingScheduleRef.current)
      }
      pendingScheduleRef.current = null
      closeForm()
    },
    onError: () => {
      pendingScheduleRef.current = null
      toast.error('Unable to create note', { icon: '❌' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title: string; content: string } }) =>
      apiClient.put<Note>(`/api/notes/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Note updated', { icon: '💾' })
      if (variables.id && pendingScheduleRef.current) {
        registerSchedule(variables.id, pendingScheduleRef.current)
      }
      pendingScheduleRef.current = null
      closeForm()
    },
    onError: () => {
      pendingScheduleRef.current = null
      toast.error('Unable to update note', { icon: '❌' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/notes/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      registerSchedule(id, null)
      toast.success('Note removed', { icon: '🗑️' })
    },
    onError: () => toast.error('Unable to delete note', { icon: '❌' }),
  })

  const getNoteSchedule = useCallback(
    (note: Note) => {
      const scheduled = noteSchedules[note._id]
      const candidate = scheduled ?? note.createdAt ?? new Date().toISOString()
      return Number.isNaN(Date.parse(candidate)) ? note.createdAt ?? new Date().toISOString() : candidate
    },
    [noteSchedules]
  )

  const notesStats = useMemo(() => {
    const now = Date.now()
    if (notes.length === 0) {
      return {
        total: 0,
        upcoming: 0,
        avgLength: 0,
        nextNote: null as { title: string; date: Date } | null,
      }
    }
    if (!Array.isArray(notes)) {
      return {
        total: 0,
        upcoming: 0,
        avgLength: 0,
        nextNote: null,
      }
    }
    const upcomingNotes = notes
      .map((note) => ({ note, date: new Date(getNoteSchedule(note)) }))
      .filter(({ date }) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    const upcoming = upcomingNotes.filter(({ date }) => date.getTime() >= now)
    const nextNote = upcoming[0]
    const avgLength = notes.length > 0
      ? Math.round(
          notes.reduce((acc, note) => acc + (note?.content?.split(/\s+/).filter(Boolean).length ?? 0), 0) / notes.length
        )
      : 0
    return {
      total: notes.length,
      upcoming: upcoming.length,
      avgLength,
      nextNote: nextNote ? { title: nextNote.note.title, date: nextNote.date } : null,
    }
  }, [notes, getNoteSchedule])

  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'past'>('all')

  const filteredNotes = useMemo(() => {
    if (!Array.isArray(notes)) return []
    const now = Date.now()
    const needle = searchQuery.toLowerCase().trim()
    return [...notes]
      .filter((note) => {
        if (!note) return false
        if (!needle) return true
        return [note.title, note.content].some((value) => value.toLowerCase().includes(needle))
      })
      .filter((note) => {
        const schedule = new Date(getNoteSchedule(note)).getTime()
        if (Number.isNaN(schedule)) return true
        if (activeFilter === 'upcoming') return schedule >= now
        if (activeFilter === 'past') return schedule < now
        return true
      })
      .sort((a, b) => {
        const aTime = new Date(getNoteSchedule(a)).getTime()
        const bTime = new Date(getNoteSchedule(b)).getTime()
        return bTime - aTime
      })
  }, [notes, searchQuery, activeFilter, getNoteSchedule])

  const noteFilters = useMemo(
    () => [
      { key: 'all' as const, label: 'All', count: notes.length },
      { key: 'upcoming' as const, label: 'Upcoming', count: notesStats.upcoming },
      {
        key: 'past' as const,
        label: 'Archived',
        count: Math.max(notes.length - notesStats.upcoming, 0),
      },
    ],
    [notes.length, notesStats.upcoming]
  )

  const formatScheduleLabel = (isoString: string) => {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return 'No schedule'
    return date.toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }


  const openNewNoteForm = () => {
    setEditingNote(null)
    resetFormData()
    setShowForm(true)
  }

  const handleEdit = (note: Note) => {
    setEditingNote(note)
    const scheduleDate = new Date(getNoteSchedule(note))
    setFormData({
      title: note.title,
      content: note.content,
      scheduledAt: toLocalInputValue(scheduleDate),
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingNote(null)
    resetFormData()
    pendingScheduleRef.current = null
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const composedISO = parseLocalInputToISO(formData.scheduledAt)
    if (!composedISO) {
      toast.error('Select a valid date and time')
      pendingScheduleRef.current = null
      return
    }
    pendingScheduleRef.current = composedISO

    if (editingNote) {
      updateMutation.mutate({ id: editingNote._id, data: { title: formData.title, content: formData.content } })
    } else {
      createMutation.mutate({ title: formData.title, content: formData.content })
    }
  }

  const handleAIGenerate = async () => {
    if (!formData.title.trim()) {
      toast.error('Enter a title or prompt to generate with AI')
      return
    }

    try {
      toast.loading('Generating note with AI…', { id: 'ai-generate' })
      const generatedContent = await aiService.generateContent({
        type: 'note',
        prompt: formData.title,
      })
      setFormData((prev) => ({ ...prev, content: generatedContent }))
      toast.success('Draft generated', { id: 'ai-generate', icon: '✨' })
    } catch (error) {
      console.error('AI generation error:', error)
      toast.error('Unable to generate with AI', { id: 'ai-generate', icon: '❌' })
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <header className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-8 py-10 shadow-2xl shadow-slate-950/40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-900/40 via-slate-950/60 to-slate-900/70" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-500/40 bg-primary-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-100">
              Ultra Premium · v3.1
            </span>
            <div className="space-y-3">
              <h1 className="flex items-center gap-3 text-3xl font-bold text-white sm:text-4xl">
                <FileText className="h-9 w-9 text-primary-300" />
                Intelligent notes
              </h1>
              <p className="text-sm text-primary-100/80 sm:text-base">
                Capture field logs, findings, and executive briefings with AI assistance, flexible scheduling, and a premium workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openNewNoteForm}
                className="inline-flex items-center gap-2 rounded-2xl border border-primary-500/50 bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-xl shadow-primary-500/40 transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                Create note
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setActiveFilter('upcoming')
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                <Sparkles className="h-4 w-4" />
                Quick schedule
              </button>
            </div>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-lg">
            <div className="rounded-2xl border border-primary-400/30 bg-slate-900/70 p-4 text-primary-50 shadow-inner shadow-primary-500/20">
              <p className="text-xs uppercase tracking-wide text-primary-200/80">Total notes</p>
              <p className="mt-2 text-3xl font-semibold">{notesStats.total}</p>
              <p className="mt-2 text-xs text-primary-100/70">Historic records and upcoming schedules.</p>
            </div>
            <div className="rounded-2xl border border-blue-400/30 bg-blue-500/15 p-4 text-blue-50 shadow-inner shadow-blue-500/20">
              <p className="text-xs uppercase tracking-wide text-blue-100/80">Upcoming entries</p>
              <p className="mt-2 text-3xl font-semibold">{notesStats.upcoming}</p>
              <p className="mt-2 text-xs text-blue-100/70">
                {notesStats.nextNote
                  ? `Next: ${notesStats.nextNote.title} · ${notesStats.nextNote.date.toLocaleString([], {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'No scheduled entries'}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 p-4 text-emerald-50 shadow-inner shadow-emerald-500/20 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-emerald-100/80">Average content length</p>
              <p className="mt-2 text-3xl font-semibold">{notesStats.avgLength} words</p>
              <p className="mt-2 text-xs text-emerald-100/70">
                Use AI to keep executive summaries concise and consistent.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, content, or keywords…"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-11 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {noteFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={cn(
                  'flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                  activeFilter === filter.key
                    ? 'border-primary-500/60 bg-primary-500/20 text-primary-100 shadow-lg shadow-primary-500/20'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-primary-200'
                )}
              >
                <span>{filter.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-[2px] text-xs text-white/80">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/40">
          {/* AI Copilot Card */}
          {!editingNote && (
            <div className="mb-6">
              <AICopilotCard />
            </div>
          )}
          
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingNote ? 'Edit note' : 'New note'}
              </h2>
              <p className="text-xs text-slate-500">Changes sync to your account and can be exported with AI.</p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Title</label>
              <input
                value={formData.title}
                onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                required
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Content</label>
                <button
                  type="button"
                  onClick={handleAIGenerate}
                  className="flex items-center gap-2 rounded-lg border border-purple-400/40 bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-100 transition hover:bg-purple-500/30"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Generate with AI
                </button>
              </div>
              <textarea
                value={formData.content}
                onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
                className="min-h-[160px] w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Document activities, findings, or executive instructions…"
                required
              />
            </div>
            <div>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date & time</span>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(event) => setFormData((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 [color-scheme:dark]"
                  required
                />
              </label>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save note
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 py-16 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-primary-400" /> Loading notes…
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center text-sm text-slate-400">
            No notes match the current filters. Adjust the search or create a scheduled note.
          </div>
        ) : (
          filteredNotes.map((note) => {
            const scheduleIso = getNoteSchedule(note)
            const scheduledDate = new Date(scheduleIso)
            const isPast = scheduledDate.getTime() < now.getTime()
            const contentPreview =
              note.content.length > 260 ? `${note.content.slice(0, 260).trimEnd()}…` : note.content

            return (
              <article
                key={note._id}
                className={cn(
                  'group relative overflow-hidden rounded-3xl border p-6 shadow-xl transition duration-300 hover:-translate-y-1',
                  isPast
                    ? 'border-slate-800/70 bg-slate-900/70'
                    : 'border-primary-500/40 bg-gradient-to-br from-slate-900/80 via-slate-950/80 to-slate-900/80'
                )}
              >
                <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-primary-500/5" />
                </div>
                <div className="relative z-10 flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                        {new Date(note.createdAt).toLocaleDateString()}
                        · {formatScheduleLabel(scheduleIso)}
                      </span>
                      <h3 className="text-xl font-semibold text-white">{note.title}</h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(note)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 transition hover:text-primary-100"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(note._id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/40 bg-red-500/20 text-red-200 transition hover:bg-red-500/30"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-200/90">{contentPreview}</p>
                  <div className="mt-auto flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200/80">
                    <span>Scheduled: {formatScheduleLabel(scheduleIso)}</span>
                    <span className="font-semibold text-white/80">
                      {Math.max(1, Math.round(note.content.split(/\s+/).filter(Boolean).length / 50))} min
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
