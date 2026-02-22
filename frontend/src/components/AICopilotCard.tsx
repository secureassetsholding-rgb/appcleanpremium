import { useMemo, useState } from 'react'
import { Sparkles, Loader2, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { aiService } from '../services/ai'
import { cn } from '../lib/utils'

const MODULES = [
  { key: 'notes', label: 'Notes', type: 'note' as const },
  { key: 'reminders', label: 'Reminders', type: 'reminder' as const },
  { key: 'expenses', label: 'Expenses', type: 'expense' as const },
  { key: 'budgets', label: 'Budgets', type: 'budget' as const },
  { key: 'quotes', label: 'Quotes', type: 'quote' as const },
  { key: 'clients', label: 'Clients', type: 'custom' as const },
]

const PROMPTS: Record<(typeof MODULES)[number]['key'], string[]> = {
  notes: [
    'Summarize inspection findings for executive lobby humidity issues.',
    'Create daily wrap-up notes for hospital sanitation crew.',
    'Draft executive highlights after today’s walkthrough.',
  ],
  reminders: [
    'Set reminder to verify PPE stock this Friday at 08:00.',
    'Alert me to document UV disinfection results tonight.',
    'Remind the team about air quality meter calibration tomorrow.',
  ],
  expenses: [
    'Log equipment rentals for moisture remediation project.',
    'Capture supply purchase for Level 2 restrooms.',
    'Track overtime crew cost for emergency response.',
  ],
  budgets: [
    'Generate remediation proposal for 12,000 sqft warehouse with humidity damage.',
    'Draft hospital wing sanitisation scope under ISO/EPA standards.',
    'Create flooring restoration budget with moisture mitigation phases.',
  ],
  quotes: [
    'Craft premium maintenance quote for corporate HQ common areas.',
    'Outline monthly facility services for logistics warehouse.',
    'Prepare specialized cleaning quote for healthcare clinic.',
  ],
  clients: [
    'Suggest onboarding actions for luxury hotel client.',
    'Outline maintenance recommendations for biotech lab.',
    'Draft follow-up talking points after initial walkthrough.',
  ],
}

type ModuleKey = (typeof MODULES)[number]['key']

interface AICopilotCardProps {
  className?: string
}

export function AICopilotCard({ className }: AICopilotCardProps) {
  const [moduleKey, setModuleKey] = useState<ModuleKey>('notes')
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const activeModule = useMemo(() => MODULES.find((module) => module.key === moduleKey) ?? MODULES[0], [moduleKey])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Enter a prompt before generating with AI')
      return
    }

    setLoading(true)
    try {
      const draft = await aiService.generateContent({
        type: activeModule.type,
        prompt,
      })
      setOutput(draft)
      toast.success('AI draft generated', { icon: '✨' })
    } catch (error) {
      console.error('AI copilot error', error)
      toast.error('Unable to generate draft right now')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!output.trim()) {
      toast.error('Generate a draft first')
      return
    }
    try {
      await navigator.clipboard.writeText(output)
      toast.success('Draft copied to clipboard', { icon: '📋' })
    } catch (error) {
      console.error('Copy error', error)
      toast.error('Clipboard access unavailable')
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-primary-500/25 bg-primary-500/10 p-4 text-primary-50 shadow-lg shadow-primary-500/20 backdrop-blur',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary-200" />
          <span className="text-xs font-semibold uppercase tracking-wide text-primary-100">AI Copilot</span>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-primary-100/70">Draft professional content fast</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {MODULES.map((module) => (
          <button
            key={module.key}
            type="button"
            onClick={() => {
              setModuleKey(module.key)
              setPrompt('')
              setOutput('')
            }}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-medium transition',
              moduleKey === module.key ? 'bg-primary-500 text-white shadow shadow-primary-500/40' : 'bg-primary-500/15 text-primary-100'
            )}
          >
            {module.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2">
        {PROMPTS[moduleKey].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setPrompt(suggestion)}
            className="rounded-xl border border-primary-500/20 bg-primary-900/20 px-3 py-2 text-left text-xs text-primary-100/90 transition hover:border-primary-400/40 hover:bg-primary-500/25"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-primary-100/80">Prompt</label>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-primary-500/20 bg-slate-950/80 px-3 py-2 text-xs text-white outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30"
            placeholder="Describe what you need in an executive tone…"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-primary-100/80">AI draft</label>
          <textarea
            value={output}
            onChange={(event) => setOutput(event.target.value)}
            rows={4}
            className="w-full resize-none rounded-xl border border-primary-500/20 bg-slate-950/80 px-3 py-2 text-xs text-white outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30"
            placeholder="AI results appear here—copy or refine before saving."
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? 'Generating…' : 'Generate draft'}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-400/40 bg-primary-400/20 text-primary-100 transition hover:bg-primary-400/30"
          title="Copy AI draft"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-primary-100/70">
        Drafts align with Bright Works compliance standards and can be transferred directly into Notes, Reminders,
        Budgets, Expenses, or Client briefings.
      </p>
    </div>
  )
}

