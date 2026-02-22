import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, MessageSquare, X, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import toast from 'react-hot-toast'

interface AIAssistantProps {
  taskName: string
  taskId?: string
  onComplete: () => void
  onUpdate?: (text: string) => void
  className?: string
}

export function AIAssistant({ taskName, onComplete, onUpdate, className }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [textInput, setTextInput] = useState('')
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    const SpeechSynthesis = window.speechSynthesis

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'es-ES' // Puedes cambiar según el idioma

      recognition.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        setTranscript(finalTranscript || interimTranscript)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        if (event.error === 'not-allowed') {
          toast.error('Permiso de micrófono denegado', { icon: '🎤' })
        } else {
          toast.error('Error en reconocimiento de voz', { icon: '❌' })
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    synthRef.current = SpeechSynthesis

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const startListening = () => {
    if (!recognitionRef.current) {
      toast.error('Reconocimiento de voz no disponible en este navegador', { icon: '⚠️' })
      return
    }

    try {
      recognitionRef.current.start()
      setIsListening(true)
      setTranscript('')
      toast.success('Escuchando... Di "completar" o "hecho" para marcar la tarea', { icon: '🎤', duration: 3000 })
    } catch (error) {
      console.error('Error starting recognition:', error)
      toast.error('Error al iniciar reconocimiento de voz', { icon: '❌' })
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const processCommand = async (command: string) => {
    setIsProcessing(true)
    
    // Normalizar el comando
    const normalizedCommand = command.toLowerCase().trim()
    
    // Comandos de voz/texto para completar tarea
    const completeKeywords = ['completar', 'completado', 'hecho', 'terminado', 'finalizado', 'listo', 'done', 'complete', 'finished']
    const isCompleteCommand = completeKeywords.some(keyword => normalizedCommand.includes(keyword))

    if (isCompleteCommand) {
      // Simular procesamiento con IA
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Responder con voz
      if (synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(`Tarea ${taskName} completada`)
        utterance.lang = 'es-ES'
        synthRef.current.speak(utterance)
      }
      
      onComplete()
      toast.success(`Tarea "${taskName}" completada automáticamente`, { icon: '✅' })
      setTranscript('')
      setTextInput('')
    } else if (normalizedCommand.length > 0) {
      // Procesar otros comandos o actualizaciones
      if (onUpdate) {
        onUpdate(normalizedCommand)
      }
      toast.success('Comando procesado', { icon: '🤖' })
    }
    
    setIsProcessing(false)
  }

  const handleTextCommand = async () => {
    if (textInput.trim()) {
      await processCommand(textInput)
      setTextInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && textInput.trim()) {
      handleTextCommand()
    }
  }

  // Auto-process when transcript changes (voice)
  useEffect(() => {
    if (transcript && !isListening && transcript.trim().length > 0) {
      const timer = setTimeout(() => {
        processCommand(transcript)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [transcript, isListening])

  return (
    <div className={cn('relative inline-block', className)}>
      {/* Botón pequeño del asistente */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 sm:h-8 sm:w-8',
          isOpen
            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/50'
            : 'bg-primary-500/20 text-primary-300 hover:bg-primary-500/30'
        )}
        aria-label={`Abrir asistente de IA para ${taskName}`}
        title="Asistente IA - Voz y Texto"
      >
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        )}
      </button>

      {/* Panel del asistente - Posicionado relativo al botón */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-80 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/20">
                <Sparkles className="h-4 w-4 text-primary-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Asistente IA</h3>
                <p className="text-xs text-slate-400">{taskName}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOpen(false)
                stopListening()
              }}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Voice Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Comando por Voz</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition',
                    isListening
                      ? 'border-red-500 bg-red-500/20 text-red-300'
                      : 'border-primary-500 bg-primary-500/20 text-primary-300 hover:bg-primary-500/30'
                  )}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Detener
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Hablar
                    </>
                  )}
                </button>
              </div>
              {transcript && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2">
                  <p className="text-xs text-slate-300">{transcript}</p>
                </div>
              )}
            </div>

            {/* Text Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Comando por Texto</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder='Escribe "completar" o "hecho"'
                  disabled={isProcessing}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
                <button
                  onClick={handleTextCommand}
                  disabled={isProcessing || !textInput.trim()}
                  className="rounded-lg border border-primary-500 bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <p className="text-xs font-semibold text-blue-300 mb-1">Comandos disponibles:</p>
              <ul className="text-xs text-blue-200/80 space-y-1">
                <li>• "completar" o "hecho" - Marca la tarea como completada</li>
                <li>• "terminado" o "listo" - Completa la tarea</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

