import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  ClipboardList,
  FileSignature,
  Factory,
  Ruler,
  Droplets,
  ShieldCheck,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Save,
  Link2,
  X,
  Loader2,
  Image as ImageIcon,
  Download,
  Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { apiClient } from '../services/api'
import { aiService } from '../services/ai'
import { cn } from '../lib/utils'
import { AICopilotCard } from '../components/AICopilotCard'
import { generateQuotePDF } from '../lib/quotePDF'

export interface Quote {
  _id: string
  clientName: string
  facilityType: string
  service: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  squareFootage?: string
  humidityProfile?: string
  sanitationScope?: string
  compliance?: string[]
  notes?: string
  qrLink?: string
  startDate?: string
  endDate?: string
  photos?: string[] // Array of base64 encoded images
}

const STATUS_LABELS: Record<Quote['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const COMPLIANCE_OPTIONS = [
  'ISO 9001 Quality Management',
  'ISO 14001 Environmental Management',
  'OSHA 29 CFR 1910 Subpart D',
  'EPA Moisture & Sanitation Guidance',
  'LEED Maintenance Readiness',
]

export default function Quotes() {
  const [search, setSearch] = useState('')
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    clientName: '',
    facilityType: '',
    service: '',
    amount: '',
    status: 'pending' as Quote['status'],
    squareFootage: '',
    humidityProfile: '',
    sanitationScope: '',
    compliance: [] as string[],
    notes: '',
    qrLink: '',
    startDate: '',
    endDate: '',
    photos: [] as string[], // Array of base64 encoded images
  })
  const queryClient = useQueryClient()

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      try {
        return await apiClient.get<Quote[]>('/api/quotes')
      } catch {
        return []
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<Quote, '_id'>) => apiClient.post<Quote>('/api/quotes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      toast.success('Professional budget registered', { icon: '📑' })
      closeForm()
    },
    onError: () => toast.error('Unable to create budget', { icon: '❌' }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Quote> }) =>
      apiClient.put<Quote>(`/api/quotes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      toast.success('Budget updated', { icon: '💾' })
      closeForm()
    },
    onError: () => toast.error('Unable to update budget', { icon: '❌' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      toast.success('Budget removed', { icon: '🗑️' })
    },
    onError: () => toast.error('Unable to delete budget', { icon: '❌' }),
  })

  const filteredQuotes = useMemo(() => {
    if (!Array.isArray(quotes)) return []
    const needle = search.toLowerCase().trim()
    return quotes
      .filter((quote) => {
        if (!quote) return false
        if (!needle) return true
        return [
          quote.clientName,
          quote.facilityType,
          quote.service,
          quote.squareFootage ?? '',
          quote.humidityProfile ?? '',
          quote.sanitationScope ?? '',
          quote.notes ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
  }, [quotes, search])

  const totals = useMemo(() => {
    if (!Array.isArray(quotes)) return { count: 0, amount: 0, approved: 0 }
    return quotes.reduce(
      (acc, quote) => {
        if (!quote) return acc
        acc.count += 1
        acc.amount += Number(quote.amount || 0)
        if (quote.status === 'approved') acc.approved += Number(quote.amount || 0)
        return acc
      },
      { count: 0, amount: 0, approved: 0 }
    )
  }, [quotes])

  const closeForm = () => {
    setShowForm(false)
    setEditingQuote(null)
    setFormData({
      clientName: '',
      facilityType: '',
      service: '',
      amount: '',
      status: 'pending',
      squareFootage: '',
      humidityProfile: '',
      sanitationScope: '',
      compliance: [],
      notes: '',
      qrLink: '',
      startDate: '',
      endDate: '',
      photos: [],
    })
  }

  const openForm = () => {
    closeForm()
    setShowForm(true)
  }

  const handleEdit = (quote: Quote) => {
    setEditingQuote(quote)
    setFormData({
      clientName: quote.clientName,
      facilityType: quote.facilityType,
      service: quote.service,
      amount: String(quote.amount),
      status: quote.status,
      squareFootage: quote.squareFootage || '',
      humidityProfile: quote.humidityProfile || '',
      sanitationScope: quote.sanitationScope || '',
      compliance: quote.compliance || [],
      notes: quote.notes || '',
      qrLink: quote.qrLink || '',
      startDate: quote.startDate ? quote.startDate.slice(0, 10) : '',
      endDate: quote.endDate ? quote.endDate.slice(0, 10) : '',
      photos: quote.photos || [],
    })
    setShowForm(true)
  }

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`File ${file.name} is not an image`, { icon: '⚠️' })
        return
      }

      // Limit file size to 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (max 5MB)`, { icon: '⚠️' })
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, base64],
        }))
        toast.success(`Photo ${file.name} added`, { icon: '📸' })
      }
      reader.onerror = () => {
        toast.error(`Failed to read ${file.name}`, { icon: '❌' })
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    event.target.value = ''
  }

  const removePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }))
    toast.success('Photo removed', { icon: '🗑️' })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const payload = {
      clientName: formData.clientName.trim(),
      facilityType: formData.facilityType.trim(),
      service: formData.service.trim(),
      amount: Number(formData.amount),
      status: formData.status,
      squareFootage: formData.squareFootage.trim(),
      humidityProfile: formData.humidityProfile.trim(),
      sanitationScope: formData.sanitationScope.trim(),
      compliance: formData.compliance,
      notes: formData.notes.trim(),
      qrLink: formData.qrLink.trim(),
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      photos: formData.photos,
    }

    if (!payload.clientName || !payload.facilityType || !payload.service || Number.isNaN(payload.amount)) {
      toast.error('Please review client, facility, scope, and budget amount')
      return
    }

    if (editingQuote) {
      updateMutation.mutate({ id: editingQuote._id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const buildAIPrompt = () => {
    const complianceSummary = formData.compliance.length > 0 ? formData.compliance.join('; ') : 'No specific standards provided'
    return `Client: ${formData.clientName || 'Unknown client'}
Facility: ${formData.facilityType || 'Infrastructure area'}
Scope: ${formData.service || 'Comprehensive maintenance & remediation'}
Square footage: ${formData.squareFootage || 'Not provided'}
Moisture / humidity: ${formData.humidityProfile || 'Typical indoor humidity'}
Sanitisation scope: ${formData.sanitationScope || 'Standard disinfection'}
Compliance focus: ${complianceSummary}
Insurance: USD $2,000,000; Licensed contractor in United States.`
  }

  const handleGenerateAI = async () => {
    if (!formData.clientName.trim() || !formData.service.trim()) {
      toast.error('Provide client name and service scope before using AI')
      return
    }

    try {
      toast.loading('Drafting infrastructure proposal…', { id: 'budget-ai' })
      const prompt = buildAIPrompt()
      const context = formData.notes
      const generated = await aiService.generateContent({ type: 'budget', prompt, context })
      setFormData((prev) => ({ ...prev, notes: generated }))
      toast.success('Professional scope generated', { id: 'budget-ai', icon: '✨' })
    } catch (error) {
      console.error('AI generation error:', error)
      toast.error('Unable to generate with AI', { id: 'budget-ai', icon: '❌' })
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <header className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-8 py-10 shadow-2xl shadow-slate-950/40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-900/70 via-slate-950/60 to-slate-900/70" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-500/40 bg-primary-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-100">
              Infrastructure budgets · v4.0
            </span>
            <div className="space-y-3">
              <h1 className="flex items-center gap-3 text-3xl font-bold text-white sm:text-4xl">
                <Building2 className="h-9 w-9 text-primary-300" /> Professional facility proposals
              </h1>
              <p className="text-sm text-primary-100/80 sm:text-base">
                Build compliant budgets for floor remediation, moisture mitigation, and sanitary upgrades aligned with ISO/EPA standards.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openForm}
                className="inline-flex items-center gap-2 rounded-2xl border border-primary-500/50 bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-xl shadow-primary-500/30 transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> New budget
              </button>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80">
                <ShieldCheck className="h-4 w-4 text-emerald-300" /> USD $2M liability · Licensed contractor
              </div>
            </div>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-lg">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 p-4 text-emerald-50 shadow-inner shadow-emerald-500/20">
              <p className="text-xs uppercase tracking-wide text-emerald-100/80">Active budgets</p>
              <p className="mt-2 text-3xl font-semibold">{quotes.length}</p>
              <p className="mt-2 text-xs text-emerald-100/70">Projects currently under evaluation.</p>
            </div>
            <div className="rounded-2xl border border-sky-400/30 bg-sky-500/15 p-4 text-sky-50 shadow-inner shadow-sky-500/20">
              <p className="text-xs uppercase tracking-wide text-sky-100/80">Approved volume</p>
              <p className="mt-2 text-3xl font-semibold">${totals.approved.toFixed(2)}</p>
              <p className="mt-2 text-xs text-sky-100/70">Budgets already green-lighted by clients.</p>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/15 p-4 text-amber-50 shadow-inner shadow-amber-500/20 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-amber-100/80">Total portfolio</p>
              <p className="mt-2 text-3xl font-semibold">${totals.amount.toFixed(2)}</p>
              <p className="mt-2 text-xs text-amber-100/70">Value of all proposals in the current pipeline.</p>
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
              placeholder="Search by client, facility or scope…"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-11 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
            />
            <FileSignature className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          </div>
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Insurance:</span> USD $2M | <span className="font-semibold text-slate-200">Compliance:</span> ISO · EPA · OSHA
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl shadow-slate-950/40">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{editingQuote ? 'Edit infrastructure budget' : 'New infrastructure budget'}</h2>
              <p className="text-xs text-slate-500">Capture square footage, humidity profile, and regulatory focus to build a premium proposal.</p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* AI Copilot Card - Always show when form is visible */}
          <div className="mt-6">
            <AICopilotCard />
          </div>
          
          <form onSubmit={handleSubmit} className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client / Owner</label>
              <input
                value={formData.clientName}
                onChange={(event) => setFormData((prev) => ({ ...prev, clientName: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Facility / Area</label>
              <input
                value={formData.facilityType}
                onChange={(event) => setFormData((prev) => ({ ...prev, facilityType: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus;border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Example: Data center flooring, hospital wing, warehouse dock"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Scope of work</label>
              <textarea
                value={formData.service}
                onChange={(event) => setFormData((prev) => ({ ...prev, service: event.target.value }))}
                className="min-h-[120px] w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Describe specialised cleaning, remediation, floor preparation, sanitary upgrades…"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estimated investment (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="25000"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</label>
              <select
                value={formData.status}
                onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value as Quote['status'] }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Square footage (ft²)</label>
              <input
                value={formData.squareFootage}
                onChange={(event) => setFormData((prev) => ({ ...prev, squareFootage: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Ex. 12,500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Humidity / moisture profile</label>
              <input
                value={formData.humidityProfile}
                onChange={(event) => setFormData((prev) => ({ ...prev, humidityProfile: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Ex. 65% RH, condensate, flood remediation"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sanitation / decontamination scope</label>
              <input
                value={formData.sanitationScope}
                onChange={(event) => setFormData((prev) => ({ ...prev, sanitationScope: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="HEPA, ATP validation, EPA List N disinfectants"
              />
            </div>
            <div className="space-y-3 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Regulatory focus</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {COMPLIANCE_OPTIONS.map((option) => {
                  const checked = formData.compliance.includes(option)
                  return (
                    <label
                      key={option}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs transition',
                        checked ? 'border-primary-500 bg-primary-500/10 text-primary-100' : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-primary-500/40'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setFormData((prev) => ({
                            ...prev,
                            compliance: event.target.checked
                              ? [...prev.compliance, option]
                              : prev.compliance.filter((item) => item !== option),
                          }))
                        }}
                        className="mt-[3px] h-4 w-4 cursor-pointer accent-primary-500"
                      />
                      <span>{option}</span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Start window
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(event) => setFormData((prev) => ({ ...prev, startDate: event.target.value }))}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                />
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Completion target
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(event) => setFormData((prev) => ({ ...prev, endDate: event.target.value }))}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                />
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Direct QR link (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  value={formData.qrLink}
                  onChange={(event) => setFormData((prev) => ({ ...prev, qrLink: event.target.value }))}
                  placeholder="https://…"
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                />
                <a
                  href={formData.qrLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary-500/40 bg-primary-500/20 text-primary-100 hover:bg-primary-500/30"
                  title="Open link"
                >
                  <Link2 className="h-4 w-4" />
                </a>
              </div>
            </div>
            {/* Photo Upload Section */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 block">
                Photos (will be included in PDF)
              </label>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/50 p-6 transition hover:border-primary-500 hover:bg-slate-900/70">
                  <Upload className="h-5 w-5 text-slate-400" />
                  <span className="text-sm text-slate-300">Click to upload photos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                
                {formData.photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {formData.photos.map((photo, index) => (
                      <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
                        <img
                          src={photo}
                          alt={`Photo ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600/90 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {formData.photos.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {formData.photos.length} photo{formData.photos.length !== 1 ? 's' : ''} attached
                  </p>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Professional scope notes</label>
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  className="flex items-center gap-2 rounded-lg border border-primary-500/40 bg-primary-500/15 px-3 py-1.5 text-xs font-semibold text-primary-100 transition hover:bg-primary-500/25"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Generate with AI
                </button>
              </div>
              <textarea
                value={formData.notes}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                className="min-h-[180px] w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Add additional notes, exclusions, insurance statements, or deliverables."
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
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save budget
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 py-16 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-primary-300" /> Loading budgets…
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
            No budgets with that criteria.
          </div>
        ) : (
          filteredQuotes.map((quote) => {
            return (
              <article
                key={quote._id}
                className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl transition duration-300 hover:-translate-y-1"
              >
                <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-primary-500/5" />
                </div>
                <div className="relative z-10 flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
                        quote.status === 'approved'
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                          : quote.status === 'rejected'
                          ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                          : 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                      )}>
                        {STATUS_LABELS[quote.status]}
                      </span>
                      <h3 className="text-xl font-semibold text-white">{quote.clientName}</h3>
                      <p className="text-sm text-slate-200/85">{quote.facilityType}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            toast.loading('Generating PDF...', { id: `quote-pdf-${quote._id}` })
                            await generateQuotePDF(quote)
                            toast.success('PDF generated successfully!', { id: `quote-pdf-${quote._id}`, icon: '📄' })
                          } catch (error) {
                            console.error('PDF generation error:', error)
                            toast.error('Failed to generate PDF', { id: `quote-pdf-${quote._id}` })
                          }
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500/20 text-blue-200 transition hover:bg-blue-500/30"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(quote)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 transition hover:text-primary-100"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(quote._id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-slate-200/90">
                      <Factory className="h-4 w-4 text-primary-200" /> {quote.service}
                    </div>
                    <div className="flex items-center gap-2 text-slate-200/90">
                      <Ruler className="h-4 w-4 text-primary-200" /> {quote.squareFootage || 'ft² pending'}
                    </div>
                    <div className="flex items-center gap-2 text-slate-200/90">
                      <Droplets className="h-4 w-4 text-primary-200" /> {quote.humidityProfile || 'Humidity assessment TBD'}
                    </div>
                    <div className="flex items-center gap-2 text-slate-200/90">
                      <ClipboardList className="h-4 w-4 text-primary-200" /> {quote.sanitationScope || 'Sanitation scope pending'}
                    </div>
                  </div>
                  {quote.compliance && quote.compliance.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-300">
                      {quote.compliance && Array.isArray(quote.compliance) && quote.compliance.map((item) => (
                        <span key={item} className="rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-primary-100">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  {quote.photos && quote.photos.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <ImageIcon className="h-4 w-4" />
                      <span>{quote.photos.length} photo{quote.photos.length !== 1 ? 's' : ''} attached</span>
                    </div>
                  )}
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200/80">
                    {quote.notes || 'No additional notes recorded.'}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
                    <span>
                      {quote.startDate ? new Date(quote.startDate).toLocaleDateString() : 'Start TBD'}
                      {' • '}
                      {quote.endDate ? new Date(quote.endDate).toLocaleDateString() : 'Completion TBD'}
                    </span>
                    <span className="text-sm font-semibold text-primary-200">${quote.amount.toFixed(2)}</span>
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
