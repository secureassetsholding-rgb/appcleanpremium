import { FileText, Mail, MessageCircle, Send } from 'lucide-react'
import { cn } from '../lib/utils'

export type ShareAction = 'pdf' | 'mail' | 'whatsapp' | 'telegram'

interface ShareOptionsProps {
  onAction: (action: ShareAction) => void
  className?: string
}

export function ShareOptions({ onAction, className }: ShareOptionsProps) {
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      <button
        onClick={() => onAction('pdf')}
        className="flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20 active:scale-95 sm:flex-initial"
      >
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span>PDF</span>
      </button>
      <button
        onClick={() => onAction('mail')}
        className="flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 active:scale-95 sm:flex-initial"
      >
        <Mail className="h-4 w-4 flex-shrink-0" />
        <span>Mail</span>
      </button>
      <button
        onClick={() => onAction('whatsapp')}
        className="flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-100 transition hover:bg-green-500/20 active:scale-95 sm:flex-initial"
      >
        <MessageCircle className="h-4 w-4 flex-shrink-0" />
        <span>WhatsApp</span>
      </button>
      <button
        onClick={() => onAction('telegram')}
        className="flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 active:scale-95 sm:flex-initial"
      >
        <Send className="h-4 w-4 flex-shrink-0" />
        <span>Telegram</span>
      </button>
    </div>
  )
}

// Helper function to share via WhatsApp
export function shareViaWhatsApp(message: string, fileUrl?: string) {
  const encodedMessage = encodeURIComponent(message)
  const url = fileUrl 
    ? `https://web.whatsapp.com/send?text=${encodedMessage}%0A%0A${encodeURIComponent('Download: ' + fileUrl)}`
    : `https://web.whatsapp.com/send?text=${encodedMessage}`
  window.open(url, '_blank')
}

// Helper function to share via Telegram
export function shareViaTelegram(message: string, fileUrl?: string) {
  const encodedMessage = encodeURIComponent(message)
  const url = fileUrl
    ? `https://t.me/share/url?url=${encodeURIComponent(fileUrl)}&text=${encodedMessage}`
    : `https://t.me/share/url?text=${encodedMessage}`
  window.open(url, '_blank')
}


