import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Loader2,
  X,
  Download,
  Send,
  CheckCircle,
  Mic,
} from 'lucide-react'
import { apiClient } from '../services/api'
import {
  listClientInvoices,
  createClientInvoice,
  getInvoice,
  updateInvoice,
  finalizeInvoice,
  downloadInvoicePdf,
  sendInvoiceToClient,
  type Invoice,
  type InvoiceLineItem,
} from '../services/invoices'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { cn } from '../lib/utils'

const ROWS = 15
const DEFAULT_LINE: InvoiceLineItem = {
  category: '',
  description: '',
  qty: 0,
  unitPrice: 0,
  taxable: false,
  taxRate: 0,
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'es-ES', label: 'Español' },
  { code: 'pt-BR', label: 'Português' },
] as const

type ClientRecord = {
  _id: string
  name: string
  contact?: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  [key: string]: unknown
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [tab, setTab] = useState<'overview' | 'invoices'>('overview')
  const [showEditor, setShowEditor] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(
    Array.from({ length: ROWS }, () => ({ ...DEFAULT_LINE }))
  )
  const [notes, setNotes] = useState('')
  const [legalNote, setLegalNote] = useState('')
  const [dictationLang, setDictationLang] = useState<string>(() => {
    try {
      return localStorage.getItem('invoice_dictation_lang') || 'en-US'
    } catch {
      return 'en-US'
    }
  })
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null)

  const isSuperAdmin = user?.role === 'superadmin'

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => apiClient.get<ClientRecord>(`/api/clients/${id}`),
    enabled: !!id,
  })

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () => listClientInvoices(id!),
    enabled: !!id && isSuperAdmin,
  })

  useEffect(() => {
    if (!isSuperAdmin) {
      if (user?.role === 'admin') navigate('/dashboard', { replace: true })
      else navigate('/schedule', { replace: true })
    }
  }, [isSuperAdmin, user?.role, navigate])

  useEffect(() => {
    try {
      localStorage.setItem('invoice_dictation_lang', dictationLang)
    } catch {}
  }, [dictationLang])

  const startDictation = (targetField: 'description' | 'qty' | 'unitPrice' | 'notes' | 'legalNote', rowIndex?: number) => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognition || isListening) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = dictationLang
    recognitionRef.current = recognition

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = (event.results[0]?.[0]?.transcript ?? '').trim()
      if (targetField === 'description' && rowIndex !== undefined) {
        setLineItems((prev) => {
          const next = [...prev]
          next[rowIndex] = { ...next[rowIndex], description: (next[rowIndex].description || '') + (next[rowIndex].description ? ' ' : '') + transcript }
          return next
        })
      } else if (targetField === 'qty' && rowIndex !== undefined) {
        const num = parseFloat(transcript.replace(/,/g, '.'))
        if (!Number.isNaN(num)) {
          setLineItems((prev) => {
            const next = [...prev]
            next[rowIndex] = { ...next[rowIndex], qty: num }
            return next
          })
        }
      } else if (targetField === 'unitPrice' && rowIndex !== undefined) {
        const num = parseFloat(transcript.replace(/,/g, '.'))
        if (!Number.isNaN(num)) {
          setLineItems((prev) => {
            const next = [...prev]
            next[rowIndex] = { ...next[rowIndex], unitPrice: num }
            return next
          })
        }
      } else if (targetField === 'notes') setNotes((prev) => prev + (prev ? ' ' : '') + transcript)
      else if (targetField === 'legalNote') setLegalNote((prev) => prev + (prev ? ' ' : '') + transcript)
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }
    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }
    setIsListening(true)
    recognition.start()
  }

  const createMutation = useMutation({
    mutationFn: () => createClientInvoice(id!, { lineItems, notes, legalNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', id] })
      toast.success('Invoice created')
      closeEditor()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create invoice'),
  })

  const updateMutation = useMutation({
    mutationFn: () => updateInvoice(editingInvoice!._id, { lineItems, notes, legalNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', id] })
      toast.success('Invoice updated')
      closeEditor()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update invoice'),
  })

  const finalizeMutation = useMutation({
    mutationFn: (invId: string) => finalizeInvoice(invId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', id] })
      toast.success('Invoice finalized')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to finalize'),
  })

  const sendMutation = useMutation({
    mutationFn: (invId: string) => sendInvoiceToClient(invId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', id] })
      toast.success('Invoice sent to client')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to send'),
  })

  function openNewInvoice() {
    setEditingInvoice(null)
    setLineItems(Array.from({ length: ROWS }, () => ({ ...DEFAULT_LINE })))
    setNotes('')
    setLegalNote('')
    setShowEditor(true)
  }

  function openEditInvoice(inv: Invoice) {
    setEditingInvoice(inv)
    const lines = [...(inv.lineItems || [])]
    while (lines.length < ROWS) lines.push({ ...DEFAULT_LINE })
    setLineItems(lines.slice(0, ROWS))
    setNotes(inv.notes ?? '')
    setLegalNote(inv.legalNote ?? '')
    setShowEditor(true)
  }

  function closeEditor() {
    setShowEditor(false)
    setEditingInvoice(null)
  }

  function handleSaveInvoice() {
    if (editingInvoice) updateMutation.mutate()
    else createMutation.mutate()
  }

  const subtotal = lineItems.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0)
  const taxTotal = lineItems.reduce((s, l) => {
    const lineSub = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0)
    return s + (l.taxable ? lineSub * (Number(l.taxRate) || 0) : 0)
  }, 0)
  const total = subtotal + taxTotal

  if (clientLoading || !client) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/clients')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{client.name}</h1>
          <p className="text-sm text-slate-400">Client detail</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition',
            tab === 'overview'
              ? 'bg-primary-500/20 text-primary-200'
              : 'text-slate-400 hover:text-white'
          )}
        >
          Overview
        </button>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setTab('invoices')}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              tab === 'invoices'
                ? 'bg-primary-500/20 text-primary-200'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Invoices
          </button>
        )}
      </div>

      {tab === 'overview' && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {client.email && (
              <div className="flex items-center gap-3 text-slate-200">
                <Mail className="h-5 w-5 text-primary-400" />
                <span>{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3 text-slate-200">
                <Phone className="h-5 w-5 text-primary-400" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-3 text-slate-200 sm:col-span-2">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary-400" />
                <span>{client.address}</span>
              </div>
            )}
            {client.contact && (
              <div className="text-slate-400 sm:col-span-2">
                Contact: {client.contact}
              </div>
            )}
            {client.notes && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-300 sm:col-span-2">
                {client.notes}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'invoices' && isSuperAdmin && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Invoices</h2>
            <button
              type="button"
              onClick={openNewInvoice}
              className="inline-flex items-center gap-2 rounded-xl border border-primary-500/50 bg-primary-500 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> New invoice
            </button>
          </div>
          {invoicesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="py-6 text-center text-slate-400">No invoices yet.</p>
          ) : (
            <ul className="space-y-2">
              {invoices.map((inv) => (
                <li
                  key={inv._id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-slate-400" />
                    <span className="font-medium text-white">{inv.invoiceNumber}</span>
                    <span className="text-sm text-slate-400">{inv.status}</span>
                    {inv.sentAt && (
                      <span className="text-xs text-slate-500">Sent {new Date(inv.sentAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {inv.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => openEditInvoice(inv)}
                        className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white"
                      >
                        Edit
                      </button>
                    )}
                    {inv.status !== 'DRAFT' && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const blob = await downloadInvoicePdf(inv._id)
                              const a = document.createElement('a')
                              a.href = URL.createObjectURL(blob)
                              a.download = `invoice-${inv.invoiceNumber}.pdf`
                              a.click()
                              URL.revokeObjectURL(a.href)
                            } catch {
                              toast.error('Download failed')
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white"
                        >
                          <Download className="h-4 w-4" /> PDF
                        </button>
                        {inv.status === 'FINAL' && (
                          <button
                            type="button"
                            onClick={() => sendMutation.mutate(inv._id)}
                            disabled={sendMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-primary-500 bg-primary-500/20 px-3 py-1.5 text-sm text-primary-200"
                          >
                            <Send className="h-4 w-4" /> Send
                          </button>
                        )}
                      </>
                    )}
                    {inv.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => finalizeMutation.mutate(inv._id)}
                        disabled={finalizeMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-200"
                      >
                        <CheckCircle className="h-4 w-4" /> Finalize
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="my-8 w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {editingInvoice ? `Edit ${editingInvoice.invoiceNumber}` : 'New invoice'}
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Voice:</label>
                <select
                  value={dictationLang}
                  onChange={(e) => setDictationLang(e.target.value)}
                  disabled={isListening}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                {isListening && <span className="text-xs text-red-400">Listening…</span>}
              </div>
              <button type="button" onClick={closeEditor} className="rounded-lg p-2 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="p-2">Category</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 w-20">Qty</th>
                    <th className="p-2 w-24">Unit price</th>
                    <th className="p-2 w-16">Taxable</th>
                    <th className="p-2 w-20">Tax rate</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line, idx) => (
                    <tr key={idx} className="border-b border-slate-800">
                      <td className="p-2">
                        <input
                          value={line.category ?? ''}
                          onChange={(e) => {
                            const next = [...lineItems]
                            next[idx] = { ...next[idx], category: e.target.value }
                            setLineItems(next)
                          }}
                          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-white"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            value={line.description ?? ''}
                            onChange={(e) => {
                              const next = [...lineItems]
                              next[idx] = { ...next[idx], description: e.target.value }
                              setLineItems(next)
                            }}
                            className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-white"
                          />
                          <button
                            type="button"
                            onClick={() => startDictation('description', idx)}
                            disabled={isListening}
                            title="Dictate"
                            className={cn(
                              'rounded p-1.5',
                              isListening ? 'bg-red-500/30 text-red-300' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                            )}
                          >
                            <Mic className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={line.qty ?? ''}
                            onChange={(e) => {
                              const next = [...lineItems]
                              next[idx] = { ...next[idx], qty: parseFloat(e.target.value) || 0 }
                              setLineItems(next)
                            }}
                            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-white"
                          />
                          <button
                            type="button"
                            onClick={() => startDictation('qty', idx)}
                            disabled={isListening}
                            className={cn(
                              'rounded p-1.5',
                              isListening ? 'bg-red-500/30 text-red-300' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                            )}
                          >
                            <Mic className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unitPrice ?? ''}
                            onChange={(e) => {
                              const next = [...lineItems]
                              next[idx] = { ...next[idx], unitPrice: parseFloat(e.target.value) || 0 }
                              setLineItems(next)
                            }}
                            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-white"
                          />
                          <button
                            type="button"
                            onClick={() => startDictation('unitPrice', idx)}
                            disabled={isListening}
                            className={cn(
                              'rounded p-1.5',
                              isListening ? 'bg-red-500/30 text-red-300' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                            )}
                          >
                            <Mic className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={!!line.taxable}
                          onChange={(e) => {
                            const next = [...lineItems]
                            next[idx] = { ...next[idx], taxable: e.target.checked }
                            setLineItems(next)
                          }}
                          className="rounded border-slate-600"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={line.taxRate ?? ''}
                          onChange={(e) => {
                            const next = [...lineItems]
                            next[idx] = { ...next[idx], taxRate: parseFloat(e.target.value) || 0 }
                            setLineItems(next)
                          }}
                          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-400">Notes</label>
                  <div className="flex gap-1">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => startDictation('notes')}
                      disabled={isListening}
                      className={cn(
                        'shrink-0 rounded p-2',
                        isListening ? 'bg-red-500/30 text-red-300' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                      )}
                      title="Dictate"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Legal note</label>
                  <div className="flex gap-1">
                    <textarea
                      value={legalNote}
                      onChange={(e) => setLegalNote(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => startDictation('legalNote')}
                      disabled={isListening}
                      className={cn(
                        'shrink-0 rounded p-2',
                        isListening ? 'bg-red-500/30 text-red-300' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                      )}
                      title="Dictate"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-right text-slate-300">
                Subtotal: {subtotal.toFixed(2)} · Tax: {taxTotal.toFixed(2)} · Total: {total.toFixed(2)}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveInvoice}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-primary-500 bg-primary-500 px-4 py-2 text-sm font-semibold text-white"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
              {editingInvoice && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const blob = await downloadInvoicePdf(editingInvoice._id)
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(blob)
                        a.download = `invoice-${editingInvoice.invoiceNumber}.pdf`
                        a.click()
                        URL.revokeObjectURL(a.href)
                      } catch {
                        toast.error('Download failed')
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2 text-sm text-white"
                  >
                    <Download className="h-4 w-4" /> Download PDF
                  </button>
                  {(editingInvoice.status === 'FINAL' || editingInvoice.status === 'SENT') && (
                    <button
                      type="button"
                      onClick={() => sendMutation.mutate(editingInvoice._id)}
                      disabled={sendMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200"
                    >
                      <Send className="h-4 w-4" /> Send to client
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
