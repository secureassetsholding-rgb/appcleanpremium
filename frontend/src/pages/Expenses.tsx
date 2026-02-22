import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Plus, Edit2, Trash2, Save, X, Loader2, Search } from 'lucide-react'
import { cn } from '../lib/utils'
import toast from 'react-hot-toast'
import { apiClient } from '../services/api'
import { AICopilotCard } from '../components/AICopilotCard'

interface Expense {
  _id: string
  title: string
  category: string
  amount: number
  description?: string
  date: string
}

const CATEGORIES = ['Supplies', 'Equipment', 'Transportation', 'Training', 'Other']

export default function Expenses() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | (typeof CATEGORIES)[number]>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    category: CATEGORIES[0],
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const queryClient = useQueryClient()

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      try {
        return await apiClient.get<Expense[]>('/api/expenses')
      } catch {
        return []
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<Expense, '_id'>) => apiClient.post<Expense>('/api/expenses', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense recorded', { icon: '💳' })
      closeForm()
    },
    onError: () => toast.error('Unable to record the expense', { icon: '❌' }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Expense> }) =>
      apiClient.put<Expense>(`/api/expenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense updated', { icon: '💾' })
      closeForm()
    },
    onError: () => toast.error('Unable to update the expense', { icon: '❌' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense removed', { icon: '🗑️' })
    },
    onError: () => toast.error('Unable to delete the expense', { icon: '❌' }),
  })

  const totalAmount = useMemo(
    () => Array.isArray(expenses) ? expenses.reduce((sum, expense) => sum + Number(expense?.amount || 0), 0) : 0,
    [expenses]
  )

  const filteredExpenses = useMemo(() => {
    if (!Array.isArray(expenses)) return []
    const needle = search.toLowerCase().trim()
    return expenses
      .filter((expense) => expense && (activeCategory === 'all' || expense.category === activeCategory))
      .filter((expense) => {
        if (!needle) return true
        return [expense.title, expense.description ?? '', expense.category]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [expenses, search, activeCategory])

  const expenseStats = useMemo(() => {
    if (!Array.isArray(expenses) || expenses.length === 0) {
      return {
        average: 0,
        topCategory: null as { name: string; amount: number } | null,
        latest: null as Expense | null,
      }
    }

    const average = totalAmount / expenses.length
    const byCategory = expenses.reduce<Record<string, number>>((acc, expense) => {
      if (!expense || !expense.category) return acc
      acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0)
      return acc
    }, {})
    const topCategoryEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    const latest = [...expenses].filter((e) => e && e.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    return {
      average,
      topCategory: topCategoryEntry ? { name: topCategoryEntry[0], amount: topCategoryEntry[1] } : null,
      latest: latest || null,
    }
  }, [expenses, totalAmount])

  const categoryFilters: { key: 'all' | (typeof CATEGORIES)[number]; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: Array.isArray(expenses) ? expenses.length : 0 },
    ...CATEGORIES.map((category) => ({
      key: category,
      label: category,
      count: Array.isArray(expenses) ? expenses.filter((expense) => expense && expense.category === category).length : 0,
    })),
  ]

  const recentExpenses = useMemo(() => {
    if (!Array.isArray(expenses)) return []
    return expenses
      .map((expense) => ({ ...expense, dateObj: new Date(expense.date) }))
      .filter((expense) => expense && !Number.isNaN(expense.dateObj.getTime()))
      .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
      .slice(0, 8)
  }, [expenses])

  const closeForm = () => {
    setShowForm(false)
    setEditingExpense(null)
    setFormData({
      title: '',
      category: CATEGORIES[0],
      amount: '',
      description: '',
      date: new Date().toISOString().slice(0, 10),
    })
  }

  const openForm = () => {
    closeForm()
    setShowForm(true)
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description || '',
      date: new Date(expense.date).toISOString().slice(0, 10),
    })
    setShowForm(true)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const payload = {
      title: formData.title.trim(),
      category: formData.category,
      amount: Number(formData.amount),
      description: formData.description.trim(),
      date: new Date(formData.date).toISOString(),
    }

    if (!payload.title || Number.isNaN(payload.amount)) {
      toast.error('Check the title and amount')
      return
    }

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense._id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <header className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-950 px-8 py-10 shadow-2xl shadow-slate-950/40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/25 via-slate-950/70 to-slate-900/70" />
        <div className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Financial control · v3.1
            </span>
            <div className="space-y-3">
              <h1 className="flex items-center gap-3 text-3xl font-bold text-white sm:text-4xl">
                <CreditCard className="h-9 w-9 text-emerald-300" /> Expense management
              </h1>
              <p className="text-sm text-emerald-50/80 sm:text-base">
                Centralize supplies, equipment, and logistics with premium reports prepared for the executive board.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openForm}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/50 bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 shadow-xl shadow-emerald-500/30 transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> Register expense
              </button>
              {expenseStats.latest && (
                <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2 text-xs font-semibold text-white/80">
                  Latest record · {expenseStats.latest.title} · {new Date(expenseStats.latest.date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-lg">
            <div className="rounded-2xl border border-emerald-400/30 bg-slate-900/70 p-4 text-emerald-50 shadow-inner shadow-emerald-500/20">
              <p className="text-xs uppercase tracking-wide text-emerald-100/80">Total recorded</p>
              <p className="mt-2 text-3xl font-semibold">${totalAmount.toFixed(2)}</p>
              <p className="mt-2 text-xs text-emerald-100/70">Sum for the current period.</p>
            </div>
            <div className="rounded-2xl border border-blue-400/30 bg-blue-500/15 p-4 text-blue-50 shadow-inner shadow-blue-500/20">
              <p className="text-xs uppercase tracking-wide text-blue-100/80">Average ticket</p>
              <p className="mt-2 text-3xl font-semibold">${expenseStats.average.toFixed(2)}</p>
              <p className="mt-2 text-xs text-blue-100/70">Balanced distribution for planning.</p>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/15 p-4 text-amber-50 shadow-inner shadow-amber-500/20 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-amber-100/80">Top category</p>
              <p className="mt-2 text-3xl font-semibold">
                {expenseStats.topCategory ? expenseStats.topCategory.name : 'No data'}
              </p>
              <p className="mt-2 text-xs text-amber-100/70">
                {expenseStats.topCategory
                  ? `Investment ${expenseStats.topCategory.amount.toFixed(2)} USD`
                  : 'Record your first expenses to unlock analytics.'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-emerald-500/20 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, concept, or vendor…"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-11 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {categoryFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveCategory(filter.key)}
                className={cn(
                  'flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40',
                  activeCategory === filter.key
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100 shadow-lg shadow-emerald-500/20'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-emerald-200'
                )}
              >
                <span>{filter.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-[2px] text-xs text-white/80">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {recentExpenses.length > 0 && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Recent flow</p>
              <h2 className="text-lg font-semibold text-white">Latest expenses</h2>
            </div>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
              {recentExpenses.length} entries
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentExpenses.map((expense) => (
              <div
                key={expense._id}
                className="min-w-[240px] rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-xs text-emerald-50 shadow-inner shadow-emerald-500/20"
              >
                <p className="text-[11px] uppercase tracking-wide text-emerald-100/80">
                  {expense.dateObj.toLocaleDateString([], { day: '2-digit', month: 'short' })}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{expense.title}</p>
                <p className="mt-1 text-[11px] text-emerald-100/70">{expense.category}</p>
                <p className="mt-2 text-sm font-semibold text-emerald-100">${expense.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/40">
          {/* AI Copilot Card */}
          {!editingExpense && (
            <div className="mb-6">
              <AICopilotCard />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{editingExpense ? 'Edit expense' : 'New expense'}</h2>
              <p className="text-xs text-slate-500">Maintain a professional ledger ready for audits.</p>
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
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category</label>
              <select
                value={formData.category}
                onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monto</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha</label>
              <input
                type="date"
                value={formData.date}
                onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</label>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                placeholder="Expense details, vendor, reference…"
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save expense
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 py-16 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-300" /> Loading expenses…
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
            No expenses match the selected filters.
          </div>
        ) : (
          filteredExpenses.map((expense) => {
            const expenseDate = new Date(expense.date)
            const preview = expense.description && expense.description.length > 160
              ? `${expense.description.slice(0, 160).trimEnd()}…`
              : expense.description

            return (
              <article
                key={expense._id}
                className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl transition duration-300 hover:-translate-y-1"
              >
                <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-transparent to-emerald-500/10" />
                </div>
                <div className="relative z-10 flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                        {expenseDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <h3 className="text-xl font-semibold text-white">{expense.title}</h3>
                      <p className="text-xs uppercase tracking-wide text-emerald-200/80">{expense.category}</p>
                    </div>
                    <span className="rounded-2xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-2 text-base font-semibold text-emerald-50 shadow-inner shadow-emerald-500/20">
                      ${expense.amount.toFixed(2)}
                    </span>
                  </div>
                  {preview && <p className="text-sm text-slate-200/85">{preview}</p>}
                  <div className="mt-auto flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200/80">
                    <span>Referencia #{expense._id.slice(-6)}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(expense)}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition hover:text-emerald-200"
                      >
                        <Edit2 className="h-4 w-4" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(expense._id)}
                        className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/30"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
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
