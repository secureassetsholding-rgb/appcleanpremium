import { useRef, useEffect, useState } from 'react'
import { X, Check, MessageSquare } from 'lucide-react'

interface SignaturePadProps {
  onSave: (signature: string, observations?: string) => void
  onCancel: () => void
  initialObservations?: string
}

export function SignaturePad({ onSave, onCancel, initialObservations = '' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [observations, setObservations] = useState(initialObservations)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const getPoint = (event: MouseEvent | TouchEvent) => {
      const bounds = canvas.getBoundingClientRect()
      if ('touches' in event && event.touches.length > 0) {
        return {
          x: event.touches[0].clientX - bounds.left,
          y: event.touches[0].clientY - bounds.top,
        }
      }
      return {
        x: (event as MouseEvent).clientX - bounds.left,
        y: (event as MouseEvent).clientY - bounds.top,
      }
    }

    const startDrawing = (event: MouseEvent | TouchEvent) => {
      event.preventDefault()
      isDrawingRef.current = true
      setIsDrawing(true)
      const point = getPoint(event)
      lastPointRef.current = point
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
    }

    const draw = (event: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return
      event.preventDefault()
      const point = getPoint(event)
      const lastPoint = lastPointRef.current

      if (lastPoint) {
        const midX = (lastPoint.x + point.x) / 2
        const midY = (lastPoint.y + point.y) / 2
        ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY)
        ctx.stroke()
      } else {
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
      }

      lastPointRef.current = point
    }

    const stopDrawing = (event: MouseEvent | TouchEvent) => {
      event.preventDefault()
      if (isDrawingRef.current && lastPointRef.current) {
        const point = getPoint(event)
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
      }
      isDrawingRef.current = false
      setIsDrawing(false)
      lastPointRef.current = null
    }

    canvas.addEventListener('mousedown', startDrawing)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDrawing)
    canvas.addEventListener('mouseleave', stopDrawing)
    canvas.addEventListener('touchstart', startDrawing, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', stopDrawing, { passive: false })
    canvas.addEventListener('touchcancel', stopDrawing, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', startDrawing)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stopDrawing)
      canvas.removeEventListener('mouseleave', stopDrawing)
      canvas.removeEventListener('touchstart', startDrawing)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stopDrawing)
      canvas.removeEventListener('touchcancel', stopDrawing)
    }
  }, [])

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const signature = canvas.toDataURL('image/png')
    onSave(signature, observations.trim() || undefined)
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-inner shadow-slate-900/50">
      {/* Observations Field */}
      <div className="mb-3">
        <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-300">
          <MessageSquare className="h-3.5 w-3.5 text-primary-400" />
          Observations / Notes (Optional)
        </label>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Add any observations, notes, or comments about today's work..."
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 resize-none"
          rows={3}
        />
      </div>
      
      {/* Signature Canvas */}
      <label className="mb-1.5 block text-xs font-semibold text-slate-300">
        Digital Signature
      </label>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="h-36 w-full touch-none rounded-xl border border-slate-700 bg-white"
          style={{ touchAction: 'none' }}
        />
        {!isDrawing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-slate-400">Sign inside the box</p>
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
        >
          <Check className="h-3.5 w-3.5" />
          Save & Sign
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
