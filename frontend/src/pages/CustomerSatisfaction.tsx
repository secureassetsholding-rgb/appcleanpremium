import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Star,
  Users,
  CheckCircle2,
  Send,
  FileText,
  X,
  TrendingUp,
  MessageSquare,
} from 'lucide-react'
import { apiClient } from '../services/api'
import { CustomerSatisfactionSurvey } from '../components/CustomerSatisfactionSurvey'
import { ShareOptions, shareViaWhatsApp, shareViaTelegram, ShareAction } from '../components/ShareOptions'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'

interface SatisfactionSurvey {
  _id: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  rating: number
  npsScore?: number
  comment?: string
  wouldRecommend?: boolean
  location?: string
  serviceType?: string
  submittedAt: string
}

interface SatisfactionStats {
  total: number
  averageRating: number
  ratings: { 5: number; 4: number; 3: number; 2: number; 1: number }
  nps: number
  wouldRecommend: number
  recent: Array<{
    _id: string
    clientName: string
    rating: number
    comment?: string
    submittedAt: string
  }>
}

export default function CustomerSatisfaction() {
  const [showSurvey, setShowSurvey] = useState(false)
  const [showShareOptions, setShowShareOptions] = useState(false)

  const { data: stats, isLoading: statsLoading } = useQuery<SatisfactionStats>({
    queryKey: ['customer-satisfaction-stats'],
    queryFn: async (): Promise<SatisfactionStats> => {
      const response = await apiClient.get<SatisfactionStats>('/api/customer-satisfaction/stats')
      return response as SatisfactionStats
    },
    refetchInterval: 30000,
  })

  const { data: surveys = [], isLoading: surveysLoading } = useQuery<SatisfactionSurvey[]>({
    queryKey: ['customer-satisfaction'],
    queryFn: async () => {
      const response = await apiClient.get('/api/customer-satisfaction')
      return Array.isArray(response) ? response : []
    },
  })

  const exportAllPDF = () => {
    if (!surveys || surveys.length === 0) {
      return
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    let yPos = margin

    // Header
    doc.setFontSize(20)
    doc.setTextColor(0, 102, 204)
    doc.text('Customer Satisfaction Report', margin, yPos)
    yPos += 10

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos)
    yPos += 10

    if (stats) {
      doc.setFontSize(14)
      doc.setTextColor(0, 0, 0)
      doc.text(`Total Surveys: ${stats.total}`, margin, yPos)
      yPos += 8
      doc.text(`Average Rating: ${stats.averageRating.toFixed(1)}/5`, margin, yPos)
      yPos += 8
      doc.text(`NPS Score: ${stats.nps.toFixed(1)}`, margin, yPos)
      yPos += 15
    }

    // Surveys
    surveys.forEach((survey, index) => {
      if (yPos > 270) {
        doc.addPage()
        yPos = margin
      }

      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.text(`${index + 1}. ${survey.clientName} - ${survey.rating}/5`, margin, yPos)
      yPos += 8

      if (survey.comment) {
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        const splitText = doc.splitTextToSize(survey.comment, pageWidth - 2 * margin)
        doc.text(splitText, margin, yPos)
        yPos += splitText.length * 5
      }

      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(
        `Submitted: ${new Date(survey.submittedAt).toLocaleString()}`,
        margin,
        yPos
      )
      yPos += 12
    })

    const filename = `Customer_Satisfaction_Report_${Date.now()}.pdf`
    doc.save(filename)
    return filename
  }

  const handleShareAction = async (action: ShareAction) => {
    setShowShareOptions(false)

    switch (action) {
      case 'pdf': {
        toast.loading('Generating PDF...', { id: 'satisfaction-pdf' })
        try {
          exportAllPDF()
          toast.success('PDF generated successfully!', { id: 'satisfaction-pdf', icon: '📄' })
        } catch (error) {
          toast.error('Failed to generate PDF', { id: 'satisfaction-pdf' })
        }
        break
      }
      case 'mail': {
        if (!stats || surveys.length === 0) {
          toast.error('No data to send', { icon: '⚠️' })
          return
        }
        try {
          toast.loading('Preparing email...', { id: 'satisfaction-email' })
          
          // Generate PDF first
          const filename = exportAllPDF()
          if (!filename) {
            toast.error('Failed to generate PDF', { id: 'satisfaction-email' })
            return
          }
          
          // Create email content
          const subject = `Customer Satisfaction Report - ${stats.averageRating.toFixed(1)}/5 Average`
          const body = encodeURIComponent(`
Customer Satisfaction Summary:
- Total Surveys: ${stats.total}
- Average Rating: ${stats.averageRating.toFixed(1)}/5
- NPS Score: ${stats.nps.toFixed(1)}
- Would Recommend: ${stats.wouldRecommend}

View full report at: ${window.location.origin}/customer-satisfaction

Note: PDF report has been generated and can be downloaded.
          `.trim())
          
          // Open email client with mailto link
          const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`
          window.location.href = mailtoLink
          
          toast.success('Email client opened', { id: 'satisfaction-email', icon: '📧' })
        } catch (error) {
          toast.error('Failed to open email client', { id: 'satisfaction-email' })
        }
        break
      }
      case 'whatsapp': {
        if (!stats) {
          toast.error('No data to share', { icon: '⚠️' })
          return
        }
        // Generate PDF first, then share message
        const filename = exportAllPDF()
        const message = `⭐ Customer Satisfaction Report\n\nTotal Surveys: ${stats.total}\nAverage Rating: ${stats.averageRating.toFixed(1)}/5 ⭐\nNPS Score: ${stats.nps.toFixed(1)}\nWould Recommend: ${stats.wouldRecommend}\n\n${filename ? '✅ PDF report generated and downloaded!' : ''}\nView full report: ${window.location.origin}/customer-satisfaction`
        shareViaWhatsApp(message)
        toast.success('Opening WhatsApp...', { icon: '💬' })
        break
      }
      case 'telegram': {
        if (!stats) {
          toast.error('No data to share', { icon: '⚠️' })
          return
        }
        // Generate PDF first, then share message
        const filename = exportAllPDF()
        const message = `⭐ Customer Satisfaction Report\n\nTotal Surveys: ${stats.total}\nAverage Rating: ${stats.averageRating.toFixed(1)}/5 ⭐\nNPS Score: ${stats.nps.toFixed(1)}\nWould Recommend: ${stats.wouldRecommend}\n\n${filename ? '✅ PDF report generated and downloaded!' : ''}\nView full report: ${window.location.origin}/customer-satisfaction`
        shareViaTelegram(message)
        toast.success('Opening Telegram...', { icon: '✈️' })
        break
      }
    }
  }

  if (statsLoading || surveysLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-400">Loading satisfaction data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Star className="h-8 w-8 text-yellow-400" />
            Customer Satisfaction
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Track and analyze customer feedback and satisfaction ratings
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSurvey(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-primary-500/40 bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
          >
            <Send className="h-4 w-4" />
            New Survey
          </button>
          <button
            onClick={() => setShowShareOptions(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <FileText className="h-4 w-4" />
            Share Report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                <Star className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Average Rating</p>
                <p className="text-2xl font-semibold text-white">{stats.averageRating.toFixed(1)}/5</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Surveys</p>
                <p className="text-2xl font-semibold text-white">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">NPS Score</p>
                <p className="text-2xl font-semibold text-white">{stats.nps.toFixed(1)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Would Recommend</p>
                <p className="text-2xl font-semibold text-white">{stats.wouldRecommend}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rating Distribution */}
      {stats && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <h3 className="mb-4 text-lg font-semibold text-white">Rating Distribution</h3>
          <div className="space-y-3">
            {([5, 4, 3, 2, 1] as const).map((rating) => {
              const count = stats.ratings[rating] || 0
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={rating} className="flex items-center gap-4">
                  <div className="flex w-24 items-center gap-1">
                    <span className="text-sm font-semibold text-slate-300">{rating}</span>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="h-6 overflow-hidden rounded-lg bg-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-16 text-right text-sm text-slate-400">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Surveys */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg">
        <div className="border-b border-slate-800 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Recent Surveys</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {surveys.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400">
              <MessageSquare className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No surveys yet. Create your first survey to get started.</p>
            </div>
          ) : (
            surveys.slice(0, 10).map((survey) => (
              <div key={survey._id} className="px-6 py-4 hover:bg-slate-800/40 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{survey.clientName}</h4>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= survey.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-slate-400">({survey.rating}/5)</span>
                    </div>
                    {survey.comment && (
                      <p className="mt-2 text-sm text-slate-300">{survey.comment}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                      {survey.location && <span>📍 {survey.location}</span>}
                      {survey.serviceType && <span>🔧 {survey.serviceType}</span>}
                      <span>{new Date(survey.submittedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showSurvey && (
        <CustomerSatisfactionSurvey onClose={() => setShowSurvey(false)} />
      )}

      {/* Share Options Modal */}
      {showShareOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowShareOptions(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Share Customer Satisfaction Report</h3>
              <button
                onClick={() => setShowShareOptions(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Choose how you want to share the customer satisfaction report
            </p>
            <ShareOptions
              onAction={handleShareAction}
              className="justify-center"
            />
          </div>
        </div>
      )}
    </div>
  )
}
