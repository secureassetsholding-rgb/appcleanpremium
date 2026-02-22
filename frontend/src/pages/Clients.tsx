import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Save,
  Sparkles,
  Loader2,
  X,
  Star,
} from 'lucide-react'
import { CustomerSatisfactionSurvey } from '../components/CustomerSatisfactionSurvey'
import toast from 'react-hot-toast'
import { apiClient } from '../services/api'
import { aiService } from '../services/ai'
import { cn } from '../lib/utils'
import { AICopilotCard } from '../components/AICopilotCard'

interface Client {
  _id: string
  name: string
  contactName: string
  email: string
  phone: string
  address?: string
  status: 'active' | 'paused' | 'finished'
  notes?: string
  services?: string
  startDate?: string
  endDate?: string
}

const STATUS_OPTIONS: Array<{ value: Client['status']; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'On hold' },
  { value: 'finished', label: 'Completed' },
]

const STATUS_STYLES: Record<Client['status'], string> = {
  active: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  paused: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
  finished: 'border-slate-500/40 bg-slate-500/15 text-slate-200',
}

export default function Clients() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Client['status']>('all')
  const [showForm, setShowForm] = useState(false)
  const [showSatisfactionSurvey, setShowSatisfactionSurvey] = useState(false)
  const [selectedClientForSurvey, setSelectedClientForSurvey] = useState<Client | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    status: 'active' as Client['status'],
    notes: '',
    services: '',
    startDate: '',
    endDate: '',
  })

  const queryClient = useQueryClient()

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      try {
        return await apiClient.get<Client[]>('/api/clients')
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: Omit<Client, '_id'>) => apiClient.post<Client>('/api/clients', payload),
    onSuccess: () => {
      toast.success('Client created', { icon: '🤝' })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      closeForm()
    },
    onError: () => toast.error('Unable to create client', { icon: '❌' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      apiClient.put<Client>(`/api/clients/${id}`, data),
    onSuccess: () => {
      toast.success('Client updated', { icon: '💾' })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      closeForm()
    },
    onError: () => toast.error('Unable to update client', { icon: '❌' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/clients/${id}`),
    onSuccess: () => {
      toast.success('Client removed', { icon: '🗑️' })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: () => toast.error('Unable to delete client', { icon: '❌' }),
  })

  const filteredClients = useMemo(() => {
    if (!Array.isArray(clients)) return []
    const needle = search.toLowerCase().trim()
    return clients
      .filter((client) => client && (statusFilter === 'all' ? true : client.status === statusFilter))
      .filter((client) => {
        if (!needle) return true
        return [client.name, client.contactName, client.email, client.phone, client.services ?? '', client.notes ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [clients, statusFilter, search])

  const closeForm = () => {
    setShowForm(false)
    setEditingClient(null)
    setFormData({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      status: 'active',
      notes: '',
      services: '',
      startDate: '',
      endDate: '',
    })
  }

  const openForm = () => {
    closeForm()
    setShowForm(true)
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      address: client.address ?? '',
      status: client.status,
      notes: client.notes ?? '',
      services: client.services ?? '',
      startDate: client.startDate ? client.startDate.slice(0, 10) : '',
      endDate: client.endDate ? client.endDate.slice(0, 10) : '',
    })
    setShowForm(true)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const payload = {
      name: formData.name.trim(),
      contactName: formData.contactName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      status: formData.status,
      notes: formData.notes.trim(),
      services: formData.services.trim(),
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
    }

    if (!payload.name || !payload.contactName) {
      toast.error('Client name and main contact are required')
      return
    }

    if (editingClient) {
      updateMutation.mutate({ id: editingClient._id, data: payload })
    } else {
      createMutation.mutate(payload as Omit<Client, '_id'>)
    }
  }

  const handleGenerateServices = async () => {
    if (!formData.name.trim()) {
      toast.error('Enter the client name before using the AI suggestion')
      return
    }

    try {
      toast.loading('Drafting service proposal…', { id: 'client-ai' })
      const generated = await aiService.generateContent({
        type: 'custom',
        prompt: `Premium cleaning services proposal for client ${formData.name}.` +
          (formData.notes ? ` Additional notes: ${formData.notes}` : ''),
      })
      setFormData((prev) => ({ ...prev, services: generated }))
      toast.success('Suggested services generated', { id: 'client-ai', icon: '✨' })
    } catch (error) {
      console.error('AI generation error:', error)
      toast.error('Unable to generate with AI', { id: 'client-ai', icon: '❌' })
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <header className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-8 py-10 shadow-2xl shadow-slate-950/40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-900/30 via-slate-950/60 to-slate-900/70" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-500/40 bg-primary-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-100">
              Client portfolio · v3.1
            </span>
            <div className="space-y-3">
              <h1 className="flex items-center gap-3 text-3xl font-bold text-white sm:text-4xl">
                <Briefcase className="h-9 w-9 text-primary-300" /> Enterprise clients
              </h1>
              <p className="text-sm text-primary-100/80 sm:text-base">
                Manage strategic accounts, contracts, and premium service offerings with an executive-first experience.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openForm}
                className="inline-flex items-center gap-2 rounded-2xl border border-primary-500/50 bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-xl shadow-primary-500/30 transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> New client
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedClientForSurvey(null)
                  setShowSatisfactionSurvey(true)
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-yellow-500/50 bg-yellow-500 px-5 py-2 text-sm font-semibold text-white shadow-xl shadow-yellow-500/30 transition hover:brightness-110"
              >
                <Star className="h-4 w-4" /> Satisfaction Survey
              </button>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80">
                <Building2 className="h-4 w-4" /> {Array.isArray(clients) ? clients.length : 0} active accounts
              </div>
            </div>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-lg">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 p-4 text-emerald-50 shadow-inner shadow-emerald-500/20">
              <p className="text-xs uppercase tracking-wide text-emerald-100/80">Active</p>
              <p className="mt-2 text-3xl font-semibold">
                {Array.isArray(clients) ? clients.filter((client) => client && client.status === 'active').length : 0}
              </p>
              <p className="mt-2 text-xs text-emerald-100/70">Contracts in active service.</p>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/15 p-4 text-amber-50 shadow-inner shadow-amber-500/20">
              <p className="text-xs uppercase tracking-wide text-amber-100/80">In negotiation</p>
              <p className="mt-2 text-3xl font-semibold">
                {Array.isArray(clients) ? clients.filter((client) => client && client.status === 'paused').length : 0}
              </p>
              <p className="mt-2 text-xs text-amber-100/70">Scope review or temporary pause.</p>
            </div>
            <div className="rounded-2xl border border-slate-400/30 bg-slate-500/15 p-4 text-slate-100 shadow-inner shadow-slate-500/20 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-100/80">Completed history</p>
              <p className="mt-2 text-3xl font-semibold">
                {Array.isArray(clients) ? clients.filter((client) => client && client.status === 'finished').length : 0}
              </p>
              <p className="mt-2 text-xs text-slate-100/70">Projects delivered or closed.</p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, contact, or service…"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 pl-11 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
            />
            <FileText className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          </div>
          <div className="flex flex-wrap gap-3">
            {[{ value: 'all', label: 'All' }, ...STATUS_OPTIONS].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value as typeof statusFilter)}
                className={cn(
                  'flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                  statusFilter === option.value
                    ? 'border-primary-500/60 bg-primary-500/20 text-primary-100 shadow-lg shadow-primary-500/20'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-primary-200'
                )}
              >
                <span>{option.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-[2px] text-xs text-white/80">
                  {option.value === 'all'
                    ? (Array.isArray(clients) ? clients.length : 0)
                    : (Array.isArray(clients) ? clients.filter((client) => client && client.status === option.value).length : 0)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl shadow-slate-950/40">
          {/* AI Copilot Card */}
          {!editingClient && (
            <div className="mb-6">
              <AICopilotCard />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingClient ? 'Edit client' : 'New client'}
              </h2>
              <p className="text-xs text-slate-500">Record contacts, services, and internal notes.</p>
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
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client</label>
              <input
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Primary contact</label>
              <input
                value={formData.contactName}
                onChange={(event) => setFormData((prev) => ({ ...prev, contactName: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</label>
              <input
                value={formData.phone}
                onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Address / location</label>
              <input
                value={formData.address}
                onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</label>
              <select
                value={formData.status}
                onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value as Client['status'] }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Start</span>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(event) => setFormData((prev) => ({ ...prev, startDate: event.target.value }))}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">End</span>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(event) => setFormData((prev) => ({ ...prev, endDate: event.target.value }))}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                />
              </label>
            </div>
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contracted services</label>
                <button
                  type="button"
                  onClick={handleGenerateServices}
                  className="flex items-center gap-2 rounded-lg border border-primary-400/40 bg-primary-500/15 px-3 py-1.5 text-xs font-semibold text-primary-100 transition hover:bg-primary-500/25"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Suggest with AI
                </button>
              </div>
              <textarea
                value={formData.services}
                onChange={(event) => setFormData((prev) => ({ ...prev, services: event.target.value }))}
                className="min-h-[140px] w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Service list, frequencies, scope…"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Internal notes</label>
              <textarea
                value={formData.notes}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Clarifications, SLAs, account specifics…"
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-400/40 bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save client
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 py-16 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-primary-300" /> Loading clients…
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
            No clients match the selected filters.
          </div>
        ) : (
          filteredClients.map((client) => {
            return (
              <article
                key={client._id}
                className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl transition duration-300 hover:-translate-y-1"
              >
                <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-primary-500/5" />
                </div>
                <div className="relative z-10 flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide', STATUS_STYLES[client.status])}>
                        {STATUS_OPTIONS.find((option) => option.value === client.status)?.label ?? 'Active'}
                      </span>
                      <h3 className="text-xl font-semibold text-white">
                        <Link to={`/clients/${client._id}`} className="hover:text-primary-200 hover:underline">
                          {client.name}
                        </Link>
                      </h3>
                      <p className="text-sm text-slate-200/85">{client.services ? client.services.split('\n')[0] : 'Tailored cleaning proposal'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(client)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 transition hover:text-primary-100"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(client._id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center gap-2 text-slate-200/90">
                      <Phone className="h-4 w-4 text-primary-200" /> {client.phone || 'No phone on file'}
                    </div>
                    <div className="flex items-center gap-2 text-slate-200/90">
                      <Mail className="h-4 w-4 text-primary-200" /> {client.email || 'No email on file'}
                    </div>
                    {client.address && (
                      <div className="flex items-start gap-2 text-slate-200/90">
                        <MapPin className="mt-0.5 h-4 w-4 text-primary-200" />
                        <span>{client.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-200/90">
                      <CalendarIcon className="h-4 w-4 text-primary-200" />
                      <span>
                        {client.startDate ? new Date(client.startDate).toLocaleDateString() : 'Start to be defined'}
                        {' · '}
                        {client.endDate ? new Date(client.endDate).toLocaleDateString() : 'Open contract'}
                      </span>
                    </div>
                  </div>
                  {client.notes && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200/80">
                      {client.notes}
                    </div>
                  )}
                </div>
              </article>
            )
          })
        )}
      </section>

      {showSatisfactionSurvey && (
        <CustomerSatisfactionSurvey
          onClose={() => {
            setShowSatisfactionSurvey(false)
            setSelectedClientForSurvey(null)
          }}
          initialClientName={selectedClientForSurvey?.name || ''}
          initialClientEmail={selectedClientForSurvey?.email || ''}
        />
      )}
    </div>
  )
}
