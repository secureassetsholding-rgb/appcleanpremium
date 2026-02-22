import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Zap, Plus, FileText, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksService, UpdateTaskParams } from '../services/tasks'
import { configService } from '../services/config'
import { TaskTable } from '../components/TaskTable'
import { AttendanceTable } from '../components/AttendanceTable'
import { cn } from '../lib/utils'
import { emailService } from '../services/email'
import { useAuth } from '../contexts/AuthContext'
import type { RoomSummary, Task, TaskSection } from '../types'
import { WORK_DAYS } from '../types'
import { roomsService } from '../services/rooms'
import { ShareOptions, shareViaWhatsApp, shareViaTelegram, ShareAction } from '../components/ShareOptions'
import { generateDailyReportPDF as generatePDF } from '../lib/dailyReportPDF'

const FALLBACK_ROOM_LABEL = 'General'
const normalizeRoomKey = (value?: string | null) => {
  if (!value || typeof value !== 'string') {
    return FALLBACK_ROOM_LABEL.toLowerCase()
  }
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : FALLBACK_ROOM_LABEL.toLowerCase()
}
const formatRoomLabel = (value?: string | null) => {
  if (!value || typeof value !== 'string') {
    return FALLBACK_ROOM_LABEL
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : FALLBACK_ROOM_LABEL
}

export default function Schedule() {
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), 0, 1)
    const days = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    return Math.ceil((days + start.getDay() + 1) / 7)
  })
  const [selectedRoomKey, setSelectedRoomKey] = useState(() => {
    if (typeof window === 'undefined') return normalizeRoomKey(FALLBACK_ROOM_LABEL)
    return localStorage.getItem('brightworks_selected_room') || normalizeRoomKey(FALLBACK_ROOM_LABEL)
  })
  const [newRoomName, setNewRoomName] = useState('')

  const queryClient = useQueryClient()
  const { user } = useAuth()
  const sectionEmailSentRef = useRef<Set<string>>(new Set())
  const dayEmailSentRef = useRef<Set<string>>(new Set())
  const skipRoomFallbackRef = useRef(false)
  const autoSaveRunningRef = useRef(false)
  const autoSavedRoomsRef = useRef<Set<string>>(new Set())
  const [selectedDayForReport, setSelectedDayForReport] = useState<number | null>(null)
  const [daySignatures, setDaySignatures] = useState<Record<string, string>>({})
  const [showDailyReportOptions, setShowDailyReportOptions] = useState(false)

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const result = await roomsService.getRooms()
      console.log('Loaded rooms:', result)
      return result
    },
    staleTime: 300_000,
    refetchOnWindowFocus: true,
  })

  const availableRooms = useMemo(() => {
    const roomMap = new Map<string, RoomSummary>()
    if (Array.isArray(rooms) && rooms.length > 0) {
      rooms.forEach((room) => {
        if (room && room.key && room.label) {
          roomMap.set(room.key, room)
        }
      })
    }
    // Always ensure General room exists
    if (!roomMap.has(normalizeRoomKey(FALLBACK_ROOM_LABEL))) {
      const now = new Date().toISOString()
      roomMap.set(normalizeRoomKey(FALLBACK_ROOM_LABEL), {
        key: normalizeRoomKey(FALLBACK_ROOM_LABEL),
        label: FALLBACK_ROOM_LABEL,
        createdAt: now,
        updatedAt: now,
      })
    }
    const sorted = Array.from(roomMap.values()).sort((a, b) => a.label.localeCompare(b.label))
    console.log('Available rooms for selector:', sorted)
    return sorted
  }, [rooms])

  const selectedRoom = useMemo(() => {
    if (!availableRooms.length) return undefined
    return availableRooms.find((room) => room.key === selectedRoomKey) ?? availableRooms[0]
  }, [availableRooms, selectedRoomKey])

  const activeRoomKey = selectedRoom?.key ?? normalizeRoomKey(FALLBACK_ROOM_LABEL)
  const activeRoomLabel = selectedRoom?.label ?? FALLBACK_ROOM_LABEL

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedRoomKey) {
      localStorage.setItem('brightworks_selected_room', selectedRoomKey)
    }
  }, [selectedRoomKey])

  // Reset auto-save tracking when week changes
  useEffect(() => {
    autoSavedRoomsRef.current.clear()
    autoSaveRunningRef.current = false
  }, [currentWeek])

  useEffect(() => {
    if (!availableRooms.length) return
    const exists = availableRooms.some((room) => room.key === selectedRoomKey)
    if (exists) {
      skipRoomFallbackRef.current = false
      return
    }
    if (skipRoomFallbackRef.current) {
      return
    }
    const fallback = availableRooms[0]
    if (fallback) {
      setSelectedRoomKey(fallback.key)
    }
  }, [availableRooms, selectedRoomKey])

  const { data: tasksRaw = [], isLoading: tasksLoading, isFetching } = useQuery({
    queryKey: ['tasks', currentWeek, activeRoomKey],
    queryFn: () => {
      // When General is selected, request all tasks (no room filter)
      const generalKey = normalizeRoomKey(FALLBACK_ROOM_LABEL)
      if (activeRoomKey === generalKey) {
        return tasksService.getTasks(currentWeek, undefined, undefined)
      }
      return tasksService.getTasks(currentWeek, activeRoomLabel, activeRoomKey)
    },
    staleTime: 30_000, // Reduced for better sync between devices
    gcTime: 300_000,
    refetchOnWindowFocus: true, // Refetch when window gains focus for better sync
    refetchOnMount: true, // Refetch on mount for better sync
  })

  // Filter tasks by active room key to ensure correct room isolation
  // When "General" is selected, show all tasks from all rooms (history)
  const tasks = useMemo(() => {
    if (!Array.isArray(tasksRaw)) return []
    const generalKey = normalizeRoomKey(FALLBACK_ROOM_LABEL)
    // If General room is selected, show all tasks (history of all rooms)
    if (activeRoomKey === generalKey) {
      return tasksRaw.filter((task) => Boolean(task))
    }
    // Otherwise, filter by active room
    return tasksRaw.filter((task) => {
      if (!task) return false
      const taskRoomKey = normalizeRoomKey(task.roomKey ?? task.room)
      return taskRoomKey === activeRoomKey
    })
  }, [tasksRaw, activeRoomKey])

  const { data: timeRecordsRaw = [] } = useQuery({
    queryKey: ['timeRecords', currentWeek, activeRoomKey],
    queryFn: async () => {
      try {
        const result = await tasksService.getTimeRecords(currentWeek, activeRoomLabel, activeRoomKey)
        return Array.isArray(result) ? result : []
      } catch {
        return []
      }
    },
    staleTime: 30_000, // Reduced for better sync between devices
    refetchOnWindowFocus: true, // Refetch when window gains focus for better sync
    refetchOnMount: true, // Refetch on mount for better sync
  })

  const { data: config } = useQuery({
    queryKey: ['taskConfig'],
    queryFn: async () => {
      try {
        const result = await configService.getConfig()
        // Ensure config has sections array
        if (result && result.sections && !Array.isArray(result.sections)) {
          return { ...result, sections: [] }
        }
        return result
      } catch {
        return null
      }
    },
    staleTime: Infinity,
  })

  const createRoomMutation = useMutation({
    mutationFn: (label: string) => roomsService.createRoom(label),
    onSuccess: (room) => {
      if (!room) {
        toast.error('Unable to create room. Try again.')
        return
      }
      queryClient.setQueryData<RoomSummary[]>(['rooms'], (previous) => {
        if (!previous) {
          return [room]
        }
        const exists = previous.some((item) => item.key === room.key)
        if (exists) {
          return previous.map((item) => (item.key === room.key ? room : item))
        }
        return [...previous, room]
      })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      setSelectedRoomKey(room.key)
      skipRoomFallbackRef.current = true
      setNewRoomName('')
      toast.success(`Room "${room.label}" added`, { icon: '🏢' })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to create room right now.'
      toast.error(message)
    },
  })

  const isCreatingRoom = createRoomMutation.isPending

  const updateTaskMutation = useMutation({
    mutationFn: tasksService.updateTask,
    onSuccess: (updatedTask, variables) => {
      console.log('🔥🔥🔥 updateTaskMutation.onSuccess LLAMADO 🔥🔥🔥', {
        taskId: updatedTask?._id,
        taskName: updatedTask?.taskName,
        completed: updatedTask?.completed,
        day: variables?.day,
        week: currentWeek
      })
      // ACTUALIZAR CACHE INMEDIATAMENTE antes de evaluar
      const generalKey = normalizeRoomKey(FALLBACK_ROOM_LABEL)
      
      // Update cache for current room - FIXED: Use same queryKey as Dashboard
      queryClient.setQueryData<Task[]>(['tasks', currentWeek, activeRoomLabel, activeRoomKey], (oldTasks = []) => {
        const existingIndex = oldTasks.findIndex((t) => t._id === updatedTask._id)
        if (existingIndex >= 0) {
          const updated = [...oldTasks]
          updated[existingIndex] = updatedTask
          return updated
        }
        return [...oldTasks, updatedTask]
      })
      
      // Also update cache for General room (if not already General) to keep history in sync
      if (activeRoomKey !== generalKey) {
        queryClient.setQueryData<Task[]>(['tasks', currentWeek, FALLBACK_ROOM_LABEL, generalKey], (oldTasks = []) => {
          const existingIndex = oldTasks.findIndex((t) => t._id === updatedTask._id)
          if (existingIndex >= 0) {
            const updated = [...oldTasks]
            updated[existingIndex] = updatedTask
            return updated
          }
          return [...oldTasks, updatedTask]
        })
      }
      
      // Invalidate queries for better sync between devices
      queryClient.invalidateQueries({ queryKey: ['tasks'] }) // Invalidate ALL task queries
      queryClient.refetchQueries({ queryKey: ['tasks', currentWeek, activeRoomLabel, activeRoomKey] })
      // Also refetch General if not already active
      if (activeRoomKey !== generalKey) {
        queryClient.refetchQueries({ queryKey: ['tasks', currentWeek, FALLBACK_ROOM_LABEL, generalKey] })
      }
      
      toast.success('Task updated', { icon: '✅', duration: 1200 })
      
      // SIEMPRE usar variables porque tiene los datos correctos
      const taskForEvaluation: Task = {
        _id: updatedTask?._id || `${variables.taskName}-${variables.day}-${currentWeek}`,
        taskName: variables.taskName || '',
        day: variables.day,
        week: currentWeek,
        completed: variables.completed ?? false,
        room: activeRoomLabel || variables.room || '',
        roomKey: activeRoomKey || variables.roomKey || '',
        userId: user?._id || '',
        createdAt: updatedTask?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Task
      
      console.log('[updateTaskMutation] ✅ Tarea actualizada, programando evaluación de sección:', {
        taskName: taskForEvaluation.taskName,
        completed: taskForEvaluation.completed,
        day: variables.day,
        week: currentWeek,
        room: activeRoomKey
      })
      
      // Evaluar después de actualizar el cache
      setTimeout(() => {
        console.log('[updateTaskMutation] 🔍 Ejecutando evaluateSectionCompletion ahora...')
        evaluateSectionCompletion(taskForEvaluation, variables)
      }, 100)
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to save the task'
      toast.error(message, { icon: '❌' })
      console.error('Task save error:', error)
    },
  })

  // AUTO-SAVE DESACTIVADO TEMPORALMENTE - Causaba problemas de rendimiento
  // Las tareas se crearán cuando el usuario las marque como completadas

  const updateTimeRecordMutation = useMutation({
    mutationFn: ({ day, payload }: { day: number; payload: { checkIn?: string; checkOut?: string; signature?: string; room?: string; roomKey?: string; employeeName?: string } }) =>
      tasksService.updateTimeRecord(currentWeek, day, {
        ...payload,
        room: activeRoomLabel,
        roomKey: activeRoomKey,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timeRecords', currentWeek, activeRoomKey] })
      toast.success(`Schedule updated (day ${variables.day})`, { icon: '🕒', duration: 1000 })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to save schedule time'
      toast.error(message, { icon: '❌' })
      console.error('Time record save error:', error)
    },
  })

  const handleTaskToggle = (taskName: string, day: number, completed: boolean) => {
    console.log('🎯🎯🎯 handleTaskToggle LLAMADO 🎯🎯🎯', {
      taskName,
      day,
      completed: !completed,
      week: currentWeek,
      room: activeRoomLabel,
      roomKey: activeRoomKey
    })
    updateTaskMutation.mutate({
      week: currentWeek,
      taskName,
      day,
      completed: !completed,
      room: activeRoomLabel,
      roomKey: activeRoomKey,
    })
  }

  const handleRoomSelect = (key: string) => {
    setSelectedRoomKey(key)
  }

  const handleRoomCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = newRoomName.trim()
    if (!trimmed) {
      toast.error('Enter a room name first.')
      return
    }
    const formatted = formatRoomLabel(trimmed)
    const existing = availableRooms.find((room) => room.label.toLowerCase() === formatted.toLowerCase())
    if (existing) {
      toast.success(`Room "${formatted}" is already available.`, { icon: 'ℹ️' })
      setSelectedRoomKey(existing.key)
      setNewRoomName('')
      return
    }
    await createRoomMutation.mutateAsync(formatted)
  }

  const timeRecordsForRoom = useMemo(() => {
    if (!Array.isArray(timeRecordsRaw)) return []
    return timeRecordsRaw.filter((record) => {
      if (!record) return false
      const recordKey = normalizeRoomKey(record.roomKey ?? record.room)
      return recordKey === activeRoomKey
    })
  }, [timeRecordsRaw, activeRoomKey])

  const completedTasksCount = useMemo(() => {
    if (!Array.isArray(tasks)) return 0
    return tasks.filter((task) => task && task.completed).length
  }, [tasks])

  const totalTasksCount = useMemo(() => {
    if (!config || !config.sections || !Array.isArray(config.sections)) return 0
    return config.sections.reduce((sum, section) => {
      if (!section || !section.tasks || !Array.isArray(section.tasks)) return sum
      return sum + section.tasks.length * 5
    }, 0)
  }, [config])

  const completionPercentage = useMemo(() => {
    return totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0
  }, [completedTasksCount, totalTasksCount])

  const renderWeekButton = (week: number) => (
    <button
      key={week}
      onClick={() => setCurrentWeek(week)}
      className={cn(
        'rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition sm:px-4 sm:text-sm',
        currentWeek === week
          ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      )}
    >
      Week {week}
    </button>
  )

  const notifySectionCompletion = async (section: TaskSection, day: number, trackerKey: string) => {
    if (!user) {
      toast.error('You must be logged in to send notifications.')
      sectionEmailSentRef.current.delete(trackerKey)
      return
    }

    try {
      await emailService.sendSectionCompletionEmail({
        sectionId: section.id,
        sectionTitle: section.title,
        day,
        week: currentWeek,
        userId: user._id,
        userName: user.fullName || user.username,
        room: activeRoomLabel,
        roomKey: activeRoomKey,
      })
      const dayName = WORK_DAYS.find((workDay) => workDay.num === day)?.fullName ?? `Day ${day}`
      toast.success(`${section.title} completed · Email sent for ${dayName}`)
    } catch (error) {
      console.error('Section completion email error:', error)
      sectionEmailSentRef.current.delete(trackerKey)
      toast.error('Unable to send section completion email right now.')
    }
  }

  const evaluateSectionCompletion = (updatedTask: Task, variables: UpdateTaskParams) => {
    console.log('[evaluateSectionCompletion] 🚀 FUNCIÓN LLAMADA:', {
      taskName: updatedTask.taskName,
      completed: updatedTask.completed,
      day: variables.day,
      week: currentWeek,
      room: activeRoomKey,
      hasConfig: !!config,
      hasSections: !!(config && config.sections && Array.isArray(config.sections))
    })
    
    if (!config || !config.sections || !Array.isArray(config.sections)) {
      console.log('[evaluateSectionCompletion] ⚠️ No hay config o secciones, retornando')
      return
    }

    // OBTENER TAREAS ACTUALIZADAS DEL CACHE directamente
    const currentTasks = queryClient.getQueryData<Task[]>(['tasks', currentWeek, activeRoomKey]) || []
    
    console.log('[evaluateSectionCompletion] 📋 Tareas en cache:', {
      count: currentTasks.length,
      tasks: currentTasks.map(t => ({ name: t.taskName, completed: t.completed, day: t.day }))
    })
    
    if (!Array.isArray(currentTasks) || !currentTasks.length) {
      console.log('[evaluateSectionCompletion] ⚠️ No hay tareas en cache, retornando')
      return
    }

    const targetSection = config.sections.find((section) => {
      if (!section || !section.tasks || !Array.isArray(section.tasks)) return false
      return section.tasks.includes(updatedTask.taskName)
    })
    if (!targetSection) return

    // Incluir roomKey en el trackerKey para evitar duplicados entre rooms
    const trackerKey = `${currentWeek}-${variables.day}-${targetSection.id}-${activeRoomKey}`

    if (!updatedTask.completed) {
      sectionEmailSentRef.current.delete(trackerKey)
      return
    }

    // Usar tareas del cache actualizado
    const mergedTasks = Array.isArray(currentTasks) 
      ? currentTasks.map((task) => (task._id === updatedTask._id ? updatedTask : task))
      : []

    if (!targetSection.tasks || !Array.isArray(targetSection.tasks)) return
    
    // Filtrar tasks por room activa para asegurar que solo se evalúen tasks de la room correcta
    const roomFilteredTasks = mergedTasks.filter((task) => {
      if (!task) return false
      const taskRoomKey = normalizeRoomKey(task.roomKey ?? task.room)
      return taskRoomKey === activeRoomKey
    })
    
    const allCompleted = targetSection.tasks.every((taskName) => {
      const task =
        taskName === updatedTask.taskName && normalizeRoomKey(updatedTask.roomKey ?? updatedTask.room) === activeRoomKey
          ? updatedTask
          : roomFilteredTasks.find((item) => item && item.taskName === taskName && item.day === variables.day)
      return Boolean(task?.completed)
    })

    // Enviar email cuando cualquier sección se complete
    if (allCompleted && !sectionEmailSentRef.current.has(trackerKey)) {
      console.log('[evaluateSectionCompletion] ✅ Sección completada, enviando email:', {
        sectionId: targetSection.id,
        sectionTitle: targetSection.title,
        day: variables.day,
        week: currentWeek,
        trackerKey
      })
      sectionEmailSentRef.current.add(trackerKey)
      void notifySectionCompletion(targetSection, variables.day, trackerKey)
    } else {
      if (allCompleted) {
        console.log('[evaluateSectionCompletion] ⚠️ Sección ya completada, email ya enviado (trackerKey:', trackerKey, ')')
      } else {
        const completedTasks = targetSection.tasks.filter((taskName) => {
          const task = taskName === updatedTask.taskName && normalizeRoomKey(updatedTask.roomKey ?? updatedTask.room) === activeRoomKey
            ? updatedTask
            : roomFilteredTasks.find((item) => item && item.taskName === taskName && item.day === variables.day)
          return Boolean(task?.completed)
        })
        console.log('[evaluateSectionCompletion] ⏳ Sección no completada aún:', {
          sectionId: targetSection.id,
          sectionTitle: targetSection.title,
          completed: completedTasks.length,
          total: targetSection.tasks.length
        })
      }
    }
  }

  const handleDaySigned = async (day: number, signature: string, observations?: string) => {
    if (!user) {
      toast.error('You must be logged in to send notifications.')
      return
    }

    // Save signature to state (con roomKey para evitar conflictos entre rooms)
    if (signature && signature.trim() !== '') {
      const signatureKey = `${day}-${currentWeek}-${activeRoomKey}`
      setDaySignatures((prev) => ({ ...prev, [signatureKey]: signature }))
    }
    
    // Save observations to localStorage for persistence
    if (observations && observations.trim() !== '') {
      localStorage.setItem(`brightworks_observations_${currentWeek}_${day}_${activeRoomKey}`, observations)
    }

    // IMPORTANTE: Guardar la firma Y observaciones en el backend a través del time record
    try {
      await updateTimeRecordMutation.mutateAsync({
        day,
        payload: {
          signature,
          observations: observations || undefined,
          room: activeRoomLabel,
          roomKey: activeRoomKey,
        }
      })
      console.log(`[handleDaySigned] ✅ Firma y observaciones guardadas en backend para día ${day}, semana ${currentWeek}, room ${activeRoomKey}`)
    } catch (error) {
      console.error('[handleDaySigned] Error guardando firma en backend:', error)
      toast.error('Error saving signature', { icon: '❌' })
      return // Don't proceed with email if signature save failed
    }

    // Incluir roomKey en el trackerKey para enviar un email por cada room
    const trackerKey = `${currentWeek}-${day}-${user._id}-${activeRoomKey}`
    if (dayEmailSentRef.current.has(trackerKey)) {
      console.log(`[handleDaySigned] ⚠️ Email ya enviado para room ${activeRoomKey} - día ${day}`)
      return
    }

    console.log('[handleDaySigned] 📝 Día firmado, preparando envío de email:', {
      day,
      week: currentWeek,
      userId: user._id,
      userName: user.fullName || user.username,
      room: activeRoomLabel,
      roomKey: activeRoomKey,
      observations: observations ? 'Yes' : 'No',
      trackerKey
    })

    dayEmailSentRef.current.add(trackerKey)
    
    // Automatically send email when day is signed
    const dayName = WORK_DAYS.find((workDay) => workDay.num === day)?.fullName ?? `Day ${day}`
    try {
      toast.loading(`Sending automatic email notification for ${dayName}...`, { id: `auto-email-${day}` })
      
      await emailService.sendDayCompletionEmail({
        day,
        week: currentWeek,
        signature,
        observations,
        userId: user._id,
        userName: user.fullName || user.username,
        room: activeRoomLabel,
        roomKey: activeRoomKey,
      })
      
      toast.success(`Automatic email sent for ${dayName}`, { 
        id: `auto-email-${day}`, 
        icon: '📧',
        duration: 3000
      })
    } catch (error) {
      console.error('Automatic email error:', error)
      dayEmailSentRef.current.delete(trackerKey)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Unable to send automatic email: ${errorMessage}`, { 
        id: `auto-email-${day}` 
      })
    }
  }

  // Handle Daily Report sharing actions
  const handleDailyReportAction = async (action: ShareAction, day: number) => {
    if (!user) {
      toast.error('You must be logged in to generate reports.')
      return
    }

    const dayName = WORK_DAYS.find((workDay) => workDay.num === day)?.fullName ?? `Day ${day}`
    const timeRecord = timeRecordsForRoom.find((record) => record.day === day)
    const signature = timeRecord?.signature || daySignatures[`${day}-${currentWeek}`] || ''
    
    setShowDailyReportOptions(false)

    switch (action) {
      case 'pdf': {
        toast.loading(`Generating PDF for ${dayName}...`, { id: `daily-report-${day}` })
        
        try {
          if (!config || !config.sections || !Array.isArray(config.sections)) {
            throw new Error('Configuration not available')
          }
          
          // Filter tasks for the selected day and room
          const dayTasks = tasks.filter((task) => task.day === day)
          const dayTimeRecords = timeRecordsForRoom.filter((r) => r.day === day)
          
          // Get observations from timeRecord or localStorage
          const dayTimeRecord = dayTimeRecords.find((r) => r.day === day)
          const observationsFromStorage = localStorage.getItem(`brightworks_observations_${currentWeek}_${day}_${activeRoomKey}`)
          const observations = dayTimeRecord?.observations || observationsFromStorage || undefined
          
          await generatePDF({
            day,
            week: currentWeek,
            tasks: dayTasks,
            timeRecords: dayTimeRecords,
            sections: config.sections.filter((s): s is TaskSection => 
              Boolean(s && s.tasks && Array.isArray(s.tasks))
            ),
            userName: user.fullName || user.username,
            userRole: user.role === 'admin' ? 'Admin' : 'Employee',
            roomLabel: activeRoomLabel,
            signature,
            observations,
          })
          
          toast.success(`PDF generated successfully for ${dayName}!`, { 
            id: `daily-report-${day}`,
            icon: '📄',
            duration: 3000
          })
        } catch (error) {
          console.error('PDF generation error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          toast.error(`Failed to generate PDF: ${errorMessage}`, { 
            id: `daily-report-${day}`
          })
        }
        break
      }
      case 'mail': {
        const trackerKey = `${currentWeek}-${day}-${user._id}-${activeRoomKey}`
        // Get observations from timeRecord or localStorage
        const observationsFromStorageMail = localStorage.getItem(`brightworks_observations_${currentWeek}_${day}_${activeRoomKey}`)
        const observationsMail = timeRecord?.observations || observationsFromStorageMail || undefined
        
        try {
          toast.loading(`Sending email for ${dayName}...`, { id: `daily-report-${day}` })
          
          await emailService.sendDayCompletionEmail({
            day,
            week: currentWeek,
            signature,
            observations: observationsMail,
            userId: user._id,
            userName: user.fullName || user.username,
            room: activeRoomLabel,
            roomKey: activeRoomKey,
          })
          
          dayEmailSentRef.current.add(trackerKey)
          toast.success(`Daily report sent via email for ${dayName}`, { 
            id: `daily-report-${day}`, 
            icon: '📧',
            duration: 3000
          })
        } catch (error) {
          console.error('Email error:', error)
          dayEmailSentRef.current.delete(trackerKey)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          toast.error(`Unable to send email: ${errorMessage}`, { 
            id: `daily-report-${day}` 
          })
        }
        break
      }
      case 'whatsapp': {
        // First generate PDF, then share
        try {
          if (!config || !config.sections || !Array.isArray(config.sections)) {
            throw new Error('Configuration not available')
          }
          
          const dayTasks = tasks.filter((task) => task.day === day)
          const dayTimeRecords = timeRecordsForRoom.filter((r) => r.day === day)
          
          // Get observations from timeRecord or localStorage
          const dayTimeRecordWA = dayTimeRecords.find((r) => r.day === day)
          const observationsFromStorageWA = localStorage.getItem(`brightworks_observations_${currentWeek}_${day}_${activeRoomKey}`)
          const observationsWA = dayTimeRecordWA?.observations || observationsFromStorageWA || undefined
          
          // Generate PDF first
          await generatePDF({
            day,
            week: currentWeek,
            tasks: dayTasks,
            timeRecords: dayTimeRecords,
            sections: config.sections.filter((s): s is TaskSection => 
              Boolean(s && s.tasks && Array.isArray(s.tasks))
            ),
            userName: user.fullName || user.username,
            userRole: user.role === 'admin' ? 'Admin' : 'Employee',
            roomLabel: activeRoomLabel,
            signature,
            observations: observationsWA,
          })
          
          const message = `📊 Daily Report - ${dayName}\nWeek ${currentWeek}\nRoom: ${activeRoomLabel}\nEmployee: ${user.fullName || user.username}${observationsWA ? `\n\n📝 Notes: ${observationsWA}` : ''}\n\n✅ PDF generated and downloaded!\nView full report at: ${window.location.origin}`
          shareViaWhatsApp(message)
          toast.success(`PDF generated! Opening WhatsApp...`, { icon: '💬' })
        } catch (error) {
          const message = `📊 Daily Report - ${dayName}\nWeek ${currentWeek}\nRoom: ${activeRoomLabel}\nEmployee: ${user.fullName || user.username}\n\nView full report at: ${window.location.origin}`
          shareViaWhatsApp(message)
          toast.success(`Opening WhatsApp...`, { icon: '💬' })
        }
        break
      }
      case 'telegram': {
        // First generate PDF, then share
        try {
          if (!config || !config.sections || !Array.isArray(config.sections)) {
            throw new Error('Configuration not available')
          }
          
          const dayTasks = tasks.filter((task) => task.day === day)
          const dayTimeRecords = timeRecordsForRoom.filter((r) => r.day === day)
          
          // Get observations from timeRecord or localStorage
          const dayTimeRecordTG = dayTimeRecords.find((r) => r.day === day)
          const observationsFromStorageTG = localStorage.getItem(`brightworks_observations_${currentWeek}_${day}_${activeRoomKey}`)
          const observationsTG = dayTimeRecordTG?.observations || observationsFromStorageTG || undefined
          
          // Generate PDF first
          await generatePDF({
            day,
            week: currentWeek,
            tasks: dayTasks,
            timeRecords: dayTimeRecords,
            sections: config.sections.filter((s): s is TaskSection => 
              Boolean(s && s.tasks && Array.isArray(s.tasks))
            ),
            userName: user.fullName || user.username,
            userRole: user.role === 'admin' ? 'Admin' : 'Employee',
            roomLabel: activeRoomLabel,
            signature,
            observations: observationsTG,
          })
          
          const message = `📊 Daily Report - ${dayName}\nWeek ${currentWeek}\nRoom: ${activeRoomLabel}\nEmployee: ${user.fullName || user.username}${observationsTG ? `\n\n📝 Notes: ${observationsTG}` : ''}\n\n✅ PDF generated and downloaded!\nView full report at: ${window.location.origin}`
          shareViaTelegram(message)
          toast.success(`PDF generated! Opening Telegram...`, { icon: '✈️' })
        } catch (error) {
          const message = `📊 Daily Report - ${dayName}\nWeek ${currentWeek}\nRoom: ${activeRoomLabel}\nEmployee: ${user.fullName || user.username}\n\nView full report at: ${window.location.origin}`
          shareViaTelegram(message)
          toast.success(`Opening Telegram...`, { icon: '✈️' })
        }
        break
      }
    }
  }


  return (
    <div className="space-y-6 pb-16">
      <header className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 shadow-lg shadow-slate-950/40 sm:rounded-2xl sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-7">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
          <div>
            <h1 className="flex items-center gap-1.5 text-lg font-semibold text-white sm:gap-2 sm:text-xl md:text-2xl lg:text-3xl">
              <CalendarIcon className="h-5 w-5 text-primary-300 sm:h-6 sm:w-6 md:h-7 md:w-7" />
              Weekly schedule
            </h1>
            {!tasksLoading && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-300 sm:mt-3 sm:gap-3 sm:text-xs md:text-sm">
                <span className="flex items-center gap-1.5 text-slate-200 sm:gap-2">
                  <Zap className="h-3 w-3 text-amber-300 sm:h-4 sm:w-4" />
                  <span className="font-semibold text-white">{completedTasksCount}</span>
                  <span>of {totalTasksCount} tasks completed</span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-emerald-300">{completionPercentage}%</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentWeek((week) => Math.max(1, week - 1))}
                disabled={currentWeek === 1}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation active:scale-95 sm:h-10 sm:w-10"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex gap-2 overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>{[1, 2, 3, 4].map(renderWeekButton)}</div>
              <button
                type="button"
                onClick={() => setCurrentWeek((week) => Math.min(4, week + 1))}
                disabled={currentWeek === 4}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation active:scale-95 sm:h-10 sm:w-10"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            {/* Daily Report Button */}
            <div className="flex items-center gap-2">
              <select
                value={selectedDayForReport || ''}
                onChange={(e) => setSelectedDayForReport(Number(e.target.value) || null)}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-white shadow-inner transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 touch-manipulation"
                style={{ minHeight: '44px' }}
              >
                <option value="">Select day</option>
                {WORK_DAYS.map((day) => (
                  <option key={day.num} value={day.num}>
                    {day.fullName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (selectedDayForReport) {
                    setShowDailyReportOptions(true)
                  } else {
                    toast.error('Please select a day first', { icon: '⚠️' })
                  }
                }}
                disabled={!selectedDayForReport}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-500/30 hover:to-emerald-600/30 hover:shadow-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation active:scale-95"
                style={{ minHeight: '44px' }}
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Daily Report</span>
                <span className="sm:hidden">Report</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 shadow-lg shadow-slate-950/40 sm:rounded-2xl sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-7">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
          <div className="flex w-full flex-col gap-1.5 sm:gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-primary-200/80 sm:text-[10px] md:text-[11px]">
              Active room
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 md:gap-4">
              <select
                value={activeRoomKey}
                onChange={(event) => handleRoomSelect(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white shadow-inner shadow-slate-950/30 transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:w-72"
              >
                {availableRooms.map((room) => (
                  <option key={room.key} value={room.key}>
                    {room.label}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-300">
                <span className="rounded-full border border-slate-700/80 px-3 py-1 text-slate-200/90">
                  {tasks.length} tasks
                </span>
                <span className="rounded-full border border-slate-700/80 px-3 py-1 text-slate-200/70">
                  {timeRecordsForRoom.length} day logs
                </span>
              </div>
            </div>
          </div>
          <form onSubmit={handleRoomCreate} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 lg:w-auto">
            <div className="flex w-full items-center gap-2 sm:w-64">
              <input
                value={newRoomName}
                onChange={(event) => setNewRoomName(event.target.value)}
                placeholder="Add a new room"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white shadow-inner shadow-slate-950/20 transition placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              />
            </div>
            <button
              type="submit"
              disabled={isCreatingRoom}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-500/40 bg-primary-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-100 transition hover:bg-primary-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {isCreatingRoom ? 'Adding…' : 'New room'}
            </button>
          </form>
        </div>
      </section>

      {tasksLoading || !config ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 py-20 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary-400" />
          <p className="text-sm text-slate-400">Loading tasks and configuration…</p>
        </div>
      ) : (
        <div className="space-y-6">
          <AttendanceTable
            key={`attendance-${activeRoomKey}`}
            week={currentWeek}
            timeRecords={timeRecordsForRoom}
            onDaySigned={handleDaySigned}
            onTimeUpdate={async (day, payload) => {
              await updateTimeRecordMutation.mutateAsync({ day, payload })
            }}
            tasks={tasks}
            config={config}
            activeRoomLabel={activeRoomLabel}
            activeRoomKey={activeRoomKey}
          />

          {config && config.sections && Array.isArray(config.sections) && config.sections
            .slice()
            .filter((section): section is TaskSection => Boolean(section && section.tasks && Array.isArray(section.tasks)))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((section) => (
              <TaskTable
                key={`${section.id}-${activeRoomKey}`}
                section={section}
                week={currentWeek}
                tasks={tasks}
                onTaskToggle={handleTaskToggle}
                timeRecords={timeRecordsForRoom}
                activeRoomLabel={activeRoomLabel}
                activeRoomKey={activeRoomKey}
              />
            ))}
        </div>
      )}

      {isFetching && !tasksLoading && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs text-slate-300 shadow-lg shadow-slate-950/40">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-300" />
          <span>Syncing changes…</span>
        </div>
      )}

      {/* Daily Report Options Modal */}
      {showDailyReportOptions && selectedDayForReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDailyReportOptions(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Share Daily Report</h3>
              <button
                onClick={() => setShowDailyReportOptions(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-6 text-sm text-slate-400">
              Choose how you want to share the daily report for{' '}
              <span className="font-semibold text-white">
                {WORK_DAYS.find((d) => d.num === selectedDayForReport)?.fullName}
              </span>
            </p>
            <div className="flex flex-col gap-4">
              <ShareOptions
                onAction={(action) => handleDailyReportAction(action, selectedDayForReport)}
                className="flex-wrap justify-center gap-3"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
