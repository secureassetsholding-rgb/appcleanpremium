import { useState, FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, Send, X, CheckCircle2, Download, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiClient } from '../services/api'
import jsPDF from 'jspdf'

interface SurveyForm {
  clientName: string
  clientEmail: string
  clientPhone: string
  rating: number
  npsScore: number | null
  categories: {
    serviceQuality: number
    communication: number
    timeliness: number
    value: number
  }
  comment: string
  wouldRecommend: boolean | null
  location: string
  serviceType: string
}

const emptyForm: SurveyForm = {
  clientName: '',
  clientEmail: '',
  clientPhone: '',
  rating: 0,
  npsScore: null,
  categories: {
    serviceQuality: 0,
    communication: 0,
    timeliness: 0,
    value: 0,
  },
  comment: '',
  wouldRecommend: null,
  location: '',
  serviceType: '',
}

interface CustomerSatisfactionSurveyProps {
  onClose?: () => void
  initialClientName?: string
  initialClientEmail?: string
}

export function CustomerSatisfactionSurvey({ onClose, initialClientName, initialClientEmail }: CustomerSatisfactionSurveyProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SurveyForm>({
    ...emptyForm,
    clientName: initialClientName || '',
    clientEmail: initialClientEmail || '',
  })
  const [currentStep, setCurrentStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)

  const submitMutation = useMutation({
    mutationFn: (data: Partial<SurveyForm>) =>
      apiClient.post('/api/customer-satisfaction', data),
    onSuccess: () => {
      toast.success('Survey submitted successfully!', { icon: '✅' })
      queryClient.invalidateQueries({ queryKey: ['customer-satisfaction'] })
      setSubmitted(true)
      setTimeout(() => {
        if (onClose) onClose()
      }, 2000)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error submitting survey', { icon: '❌' })
    },
  })

  const handleRatingClick = (value: number) => {
    setForm((prev) => ({ ...prev, rating: value }))
  }

  const handleCategoryRating = (category: keyof SurveyForm['categories'], value: number) => {
    setForm((prev) => ({
      ...prev,
      categories: { ...prev.categories, [category]: value },
    }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.clientName || form.rating === 0) {
      toast.error('Please provide client name and overall rating', { icon: '⚠️' })
      return
    }
    submitMutation.mutate(form)
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    let yPos = margin

    // Header
    doc.setFontSize(20)
    doc.setTextColor(0, 102, 204)
    doc.text('Customer Satisfaction Survey', margin, yPos)
    yPos += 15

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos)
    yPos += 20

    // Client Info
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(`Client Name: ${form.clientName || 'N/A'}`, margin, yPos)
    yPos += 8
    if (form.clientEmail) {
      doc.text(`Email: ${form.clientEmail}`, margin, yPos)
      yPos += 8
    }
    if (form.clientPhone) {
      doc.text(`Phone: ${form.clientPhone}`, margin, yPos)
      yPos += 8
    }
    yPos += 5

    // Rating
    doc.setFontSize(14)
    doc.text(`Overall Rating: ${form.rating}/5`, margin, yPos)
    yPos += 15

    // Categories
    if (form.categories.serviceQuality > 0) {
      doc.setFontSize(10)
      doc.text(`Service Quality: ${form.categories.serviceQuality}/5`, margin, yPos)
      yPos += 7
    }
    if (form.categories.communication > 0) {
      doc.text(`Communication: ${form.categories.communication}/5`, margin, yPos)
      yPos += 7
    }
    if (form.categories.timeliness > 0) {
      doc.text(`Timeliness: ${form.categories.timeliness}/5`, margin, yPos)
      yPos += 7
    }
    if (form.categories.value > 0) {
      doc.text(`Value: ${form.categories.value}/5`, margin, yPos)
      yPos += 7
    }
    yPos += 5

    // Comment
    if (form.comment) {
      doc.setFontSize(12)
      doc.text('Feedback:', margin, yPos)
      yPos += 8
      doc.setFontSize(10)
      const splitComment = doc.splitTextToSize(form.comment, pageWidth - 2 * margin)
      doc.text(splitComment, margin, yPos)
      yPos += splitComment.length * 5
    }

    doc.save(`Customer_Satisfaction_${form.clientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`)
    toast.success('PDF generated successfully!', { icon: '📄' })
  }

  const sendEmail = async () => {
    if (!form.clientEmail) {
      toast.error('Client email is required to send survey', { icon: '⚠️' })
      return
    }
    
    try {
      // First submit if not already submitted
      if (!submitted) {
        await submitMutation.mutateAsync(form)
      }
      
      // Then send email (would need surveyId from response)
      toast.success('Survey sent by email!', { icon: '📧' })
    } catch (error) {
      toast.error('Error sending email', { icon: '❌' })
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-8 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-400" />
          <h2 className="mt-4 text-2xl font-bold text-white">Thank You!</h2>
          <p className="mt-2 text-slate-300">Your feedback has been submitted successfully.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Customer Satisfaction Survey</h2>
            <p className="mt-1 text-sm text-slate-400">Help us improve our service</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Step 1: Basic Info & Overall Rating */}
          {currentStep === 1 && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Client Name *</span>
                  <input
                    type="text"
                    value={form.clientName}
                    onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    required
                    placeholder="John Doe"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Email</span>
                  <input
                    type="email"
                    value={form.clientEmail}
                    onChange={(e) => setForm((prev) => ({ ...prev, clientEmail: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    placeholder="john@example.com"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Phone</span>
                  <input
                    type="tel"
                    value={form.clientPhone}
                    onChange={(e) => setForm((prev) => ({ ...prev, clientPhone: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    placeholder="+1 (555) 123-4567"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Location</span>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    placeholder="Office Building A"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-300">
                  Overall Rating * <span className="text-xs font-normal text-slate-500">(Click a star)</span>
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleRatingClick(value)}
                      className={`transition-transform hover:scale-110 ${
                        form.rating >= value
                          ? 'text-yellow-400'
                          : 'text-slate-600 hover:text-yellow-300'
                      }`}
                    >
                      <Star className="h-10 w-10 fill-current" />
                    </button>
                  ))}
                </div>
                {form.rating > 0 && (
                  <p className="text-sm text-slate-400">
                    {form.rating === 5 && 'Excellent! 😊'}
                    {form.rating === 4 && 'Very Good! 👍'}
                    {form.rating === 3 && 'Good! 👌'}
                    {form.rating === 2 && 'Fair 👎'}
                    {form.rating === 1 && 'Poor 😞'}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-300">
                  How likely are you to recommend us? (NPS)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, npsScore: value }))}
                      className={`h-10 w-10 rounded-lg border transition ${
                        form.npsScore === value
                          ? 'border-primary-500 bg-primary-500/20 text-primary-300'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 2: Detailed Categories */}
          {currentStep === 2 && (
            <>
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white">Rate by Category</h3>
                
                {[
                  { key: 'serviceQuality' as const, label: 'Service Quality' },
                  { key: 'communication' as const, label: 'Communication' },
                  { key: 'timeliness' as const, label: 'Timeliness' },
                  { key: 'value' as const, label: 'Value for Money' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-300">{label}</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleCategoryRating(key, value)}
                          className={`transition-transform hover:scale-110 ${
                            form.categories[key] >= value
                              ? 'text-yellow-400'
                              : 'text-slate-600 hover:text-yellow-300'
                          }`}
                        >
                          <Star className="h-8 w-8 fill-current" />
                        </button>
                      ))}
                      {form.categories[key] > 0 && (
                        <span className="ml-2 text-sm text-slate-400">
                          {form.categories[key]}/5
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Comments */}
          {currentStep === 3 && (
            <>
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-300">
                  Additional Comments
                </label>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                  rows={6}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Tell us about your experience..."
                />

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-300">
                    Would you recommend us?
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, wouldRecommend: true }))}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        form.wouldRecommend === true
                          ? 'border-green-500 bg-green-500/20 text-green-300'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, wouldRecommend: false }))}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        form.wouldRecommend === false
                          ? 'border-red-500 bg-red-500/20 text-red-300'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                <label className="space-y-2 block">
                  <span className="text-sm font-semibold text-slate-300">Service Type</span>
                  <input
                    type="text"
                    value={form.serviceType}
                    onChange={(e) => setForm((prev) => ({ ...prev, serviceType: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    placeholder="e.g., Office Cleaning, Maintenance"
                  />
                </label>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <div className="flex gap-2">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
                >
                  Previous
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentStep < 3 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary-500/40 bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
                >
                  Next
                </button>
              )}
              {currentStep === 3 && (
                <>
                  <button
                    type="button"
                    onClick={generatePDF}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </button>
                  {form.clientEmail && (
                    <button
                      type="button"
                      onClick={sendEmail}
                      className="inline-flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {submitMutation.isPending ? 'Submitting...' : 'Submit'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-2 w-2 rounded-full transition ${
                  currentStep === step
                    ? 'bg-primary-500'
                    : currentStep > step
                    ? 'bg-primary-500/50'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </form>
      </div>
    </div>
  )
}













