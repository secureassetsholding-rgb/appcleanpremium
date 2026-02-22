import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Bell,
  DollarSign,
  Calendar as CalendarIcon,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Target,
  BarChart3,
  LayoutDashboard,
  Activity,
  PieChart,
  Star,
} from 'lucide-react'
import { apiClient } from '../services/api'
import { tasksService } from '../services/tasks'
import { cn } from '../lib/utils'
import { roomsService } from '../services/rooms'
import { configService } from '../services/config'
import { PremiumQRCode } from '../components/PremiumQRCode'
import { CustomerSatisfactionSurvey } from '../components/CustomerSatisfactionSurvey'
import type { RoomSummary, Task, TaskSection } from '../types'
import { WORK_DAYS } from '../types'

const FALLBACK_ROOM_LABEL = 'General'
const normalizeRoomKey = (value?: string | null) => {
  if (!value || typeof value !== 'string') return FALLBACK_ROOM_LABEL.toLowerCase()
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : FALLBACK_ROOM_LABEL.toLowerCase()
}

// Normalize completion values that may arrive as boolean/string/number
const isTaskCompleted = (completedValue: unknown): boolean => {
  if (typeof completedValue === 'boolean') return completedValue
  if (typeof completedValue === 'string') return completedValue.toLowerCase() === 'true' || completedValue === '1'
  if (typeof completedValue === 'number') return completedValue === 1
  return false
}

interface DashboardNote {
  _id: string
  title: string
  content: string
  createdAt: string
}

interface DashboardReminder {
  _id: string
  title: string
  description?: string
  dueDate: string
  completed: boolean
}

interface DashboardQuote {
  _id: string
  status: 'pending' | 'approved' | 'rejected'
  amount?: number
}

interface DashboardExpense {
  _id: string
  amount?: number
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  // FIXED: Use same week calculation as Schedule to ensure sync
  const currentWeek = useMemo(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), 0, 1)
    const days = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    return Math.ceil((days + start.getDay() + 1) / 7)
  }, [])

  const [selectedRoomKey, setSelectedRoomKey] = useState(() => {
    if (typeof window === 'undefined') return normalizeRoomKey(FALLBACK_ROOM_LABEL)
    return localStorage.getItem('brightworks_dashboard_room') || normalizeRoomKey(FALLBACK_ROOM_LABEL)
  })

  const [showSatisfactionSurvey, setShowSatisfactionSurvey] = useState(false)

  const { data: roomsRaw = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsService.getRooms(),
    staleTime: 300_000,
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch on mount
  })

  // Ensure rooms is always an array
  const rooms = useMemo(() => {
    if (!Array.isArray(roomsRaw)) return []
    return roomsRaw.filter((room): room is RoomSummary => Boolean(room))
  }, [roomsRaw])

  const availableRooms = useMemo(() => {
    if (!Array.isArray(rooms)) return []
    const map = new Map<string, RoomSummary>()
    rooms.forEach((room) => {
      if (room?.key && room?.label) {
        map.set(room.key, room)
      }
    })
    if (!map.has(normalizeRoomKey(FALLBACK_ROOM_LABEL))) {
      const now = new Date().toISOString()
      map.set(normalizeRoomKey(FALLBACK_ROOM_LABEL), {
        key: normalizeRoomKey(FALLBACK_ROOM_LABEL),
        label: FALLBACK_ROOM_LABEL,
        createdAt: now,
        updatedAt: now,
      })
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [rooms])

  const selectedRoom = useMemo(() => {
    if (!availableRooms.length) return undefined
    return availableRooms.find((room) => room.key === selectedRoomKey) ?? availableRooms[0]
  }, [availableRooms, selectedRoomKey])

  const activeRoomKey = selectedRoom?.key ?? normalizeRoomKey(FALLBACK_ROOM_LABEL)
  const activeRoomLabel = selectedRoom?.label ?? FALLBACK_ROOM_LABEL

  // Get task configuration for sections/groups
  const { data: config } = useQuery({
    queryKey: ['taskConfig'],
    queryFn: () => configService.getConfig(),
    staleTime: Infinity,
  })

  // Get tasks filtered by room - FIXED: Include activeRoomKey in queryKey to refresh when room changes
  const { data: tasksRaw = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', currentWeek, activeRoomLabel, activeRoomKey],
    queryFn: async () => {
      console.log('[Dashboard] Fetching tasks for room:', { currentWeek, activeRoomLabel, activeRoomKey })
      const tasks = await tasksService.getTasks(currentWeek, activeRoomLabel, activeRoomKey)
      console.log('[Dashboard] Tasks received from API:', {
        count: tasks.length,
        tasks: tasks.map(t => ({
          taskName: t.taskName,
          day: t.day,
          completed: t.completed,
          completedType: typeof t.completed,
          room: t.room,
          roomKey: t.roomKey,
          week: t.week
        }))
      })
      return tasks
    },
    staleTime: 10_000, // Reduced to 10 seconds for better real-time updates
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch on mount
    gcTime: 300_000, // Keep in cache for 5 minutes
  })

  // Ensure tasks is always an array
  const tasks = useMemo(() => {
    if (!Array.isArray(tasksRaw)) return []
    return tasksRaw.filter((task): task is Task => Boolean(task))
  }, [tasksRaw])

  const { data: notes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<DashboardNote[]>('/api/notes')
        return Array.isArray(result) ? result : []
      } catch {
        return []
      }
    },
  })

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<DashboardReminder[]>('/api/reminders')
        return Array.isArray(result) ? result : []
      } catch {
        return []
      }
    },
  })

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<DashboardQuote[]>('/api/quotes')
        return Array.isArray(result) ? result : []
      } catch {
        return []
      }
    },
  })

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<DashboardExpense[]>('/api/expenses')
        return Array.isArray(result) ? result : []
      } catch {
        return []
      }
    },
  })

  // Filter tasks by room - VERIFIED: tasks is always an array
  // When General is selected, show all tasks (history of all rooms)
  const roomTasks = useMemo(() => {
    if (!Array.isArray(tasks)) {
      console.log('[Dashboard] roomTasks: tasks is not an array', { tasks })
      return []
    }
    const generalKey = normalizeRoomKey(FALLBACK_ROOM_LABEL)
    // If General room is selected, show all tasks (history of all rooms)
    if (activeRoomKey === generalKey) {
      const allTasks = tasks.filter((task: Task) => Boolean(task))
      console.log('[Dashboard] General room selected - showing all tasks:', {
        activeRoomKey,
        totalTasksFromAPI: tasks.length,
        filteredTasks: allTasks.length,
        sampleTasks: allTasks.slice(0, 5).map(t => ({
          taskName: t.taskName,
          day: t.day,
          completed: t.completed,
          room: t.room,
          roomKey: t.roomKey
        }))
      })
      return allTasks
    }
    // Otherwise, filter by active room
    const filtered = tasks.filter((task: Task) => {
      if (!task) return false
      const taskRoomKey = normalizeRoomKey(task.roomKey ?? task.room)
      const matches = taskRoomKey === activeRoomKey
      return matches
    })
    console.log('[Dashboard] Room tasks filtered - TOTAL FROM API:', tasks.length)
    console.log('[Dashboard] Room tasks filtered - FILTERED COUNT:', filtered.length)
    console.log('[Dashboard] Room tasks filtered - ACTIVE ROOM KEY:', activeRoomKey)
    console.log('[Dashboard] Room tasks filtered - ALL FILTERED TASKS:', JSON.stringify(filtered, null, 2))
    if (filtered.length > 0) {
      const completedInFiltered = filtered.filter(t => {
        const completedValue = t.completed as unknown
        const isCompleted = typeof completedValue === 'boolean' ? completedValue : 
                           typeof completedValue === 'string' ? completedValue.toLowerCase() === 'true' || completedValue === '1' :
                           typeof completedValue === 'number' ? completedValue === 1 : false
        return isCompleted
      })
      console.log('[Dashboard] Room tasks filtered - COMPLETED COUNT:', completedInFiltered.length)
      console.log('[Dashboard] Room tasks filtered - COMPLETED TASKS:', JSON.stringify(completedInFiltered, null, 2))
    }
    return filtered
  }, [tasks, activeRoomKey, activeRoomLabel])

  // Group tasks by sections - FIXED: Now includes ALL sections, not just the first one
  const tasksBySection = useMemo(() => {
    if (!config || !config.sections || !Array.isArray(config.sections) || !Array.isArray(roomTasks)) return []

    // Get all section task names from config
    const allSectionTaskNames = new Set<string>()
    config.sections.forEach((section) => {
      if (section && section.tasks && Array.isArray(section.tasks)) {
        section.tasks.forEach((taskName) => allSectionTaskNames.add(taskName))
      }
    })

    // Count ALL tasks that belong to ANY section (not just tasks that are in roomTasks)
    // This ensures we count all 16 tasks across all 5 sections
    const allSectionTasks = Array.isArray(roomTasks) 
      ? roomTasks.filter((task: Task) => 
          task && task.taskName && allSectionTaskNames.has(task.taskName)
        )
      : []

    console.log('[Dashboard] Tasks by section calculation:', {
      totalSections: config.sections.length,
      allSectionTaskNames: Array.from(allSectionTaskNames),
      allSectionTasksCount: allSectionTasks.length,
      roomTasksCount: roomTasks.length
    })

    return config.sections
      .slice()
      .filter((section): section is TaskSection => Boolean(section && section.tasks && Array.isArray(section.tasks)))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((section: TaskSection) => {
        // Get tasks for this section from roomTasks
        const sectionTasks = Array.isArray(roomTasks) ? roomTasks.filter((task: Task) =>
          task && section.tasks && Array.isArray(section.tasks) && section.tasks.includes(task.taskName)
        ) : []

        // More robust completion check
        const isTaskCompleted = (completedValue: unknown): boolean => {
          if (typeof completedValue === 'boolean') return completedValue
          if (typeof completedValue === 'string') return completedValue.toLowerCase() === 'true' || completedValue === '1'
          if (typeof completedValue === 'number') return completedValue === 1
          return false
        }

        const completed = Array.isArray(sectionTasks) 
          ? sectionTasks.filter((task: Task) => task && isTaskCompleted(task.completed)).length 
          : 0
        // FIXED: Use total from config (section.tasks.length), not from existing tasks
        // This ensures we count all configured tasks, even if they don't exist in DB yet
        const total = section.tasks?.length || 0
        const pending = total - completed
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

        console.log(`[Dashboard] Section "${section.title}":`, {
          sectionId: section.id,
          total,
          completed,
          pending,
          percentage,
          sectionTasksCount: sectionTasks.length,
          taskNames: sectionTasks.map(t => t.taskName),
          completedTasks: sectionTasks.filter(t => isTaskCompleted(t.completed)).map(t => ({
            taskName: t.taskName,
            day: t.day,
            completed: t.completed,
            completedType: typeof t.completed
          })),
          pendingTasks: sectionTasks.filter(t => !isTaskCompleted(t.completed)).map(t => ({
            taskName: t.taskName,
            day: t.day,
            completed: t.completed,
            completedType: typeof t.completed
          }))
        })

        // Get tasks by day for this section - FIXED: Use total from config
        const tasksByDay = WORK_DAYS.map((day) => {
          const dayTasks = Array.isArray(sectionTasks) ? sectionTasks.filter((task: Task) => task && task.day === day.num) : []
          // Total should be the number of tasks in this section (from config), not just existing tasks
          // For now, we'll use dayTasks.length but ideally we'd count from config per day
          // Since all tasks in a section apply to all days, we use section.tasks.length
          const dayTotal = section.tasks?.length || dayTasks.length
          return {
            day: day.num,
            dayName: day.name,
            total: dayTotal,
            completed: Array.isArray(dayTasks) ? dayTasks.filter((task: Task) => task && isTaskCompleted(task.completed)).length : 0,
            tasks: dayTasks,
          }
        })

        return {
          ...section,
          total,
          completed,
          pending,
          percentage,
          tasks: sectionTasks,
          tasksByDay,
        }
      })
      .filter((section) => section.total > 0) // Only show sections with tasks
  }, [config, roomTasks])

  // Overall statistics for the room - FIXED: Count ALL tasks from ALL sections in CONFIG, not just existing tasks
  const completedTasks = useMemo(() => {
    if (!Array.isArray(roomTasks)) {
      console.log('[Dashboard] completedTasks: roomTasks is not an array')
      return 0
    }
    // More robust completion check
    const isTaskCompleted = (completedValue: unknown): boolean => {
      if (typeof completedValue === 'boolean') return completedValue
      if (typeof completedValue === 'string') return completedValue.toLowerCase() === 'true' || completedValue === '1'
      if (typeof completedValue === 'number') return completedValue === 1
      return false
    }
    const completed = roomTasks.filter((task: Task) => {
      if (!task) return false
      const isCompleted = isTaskCompleted(task.completed)
      return isCompleted
    }).length
    
    const completedTasksList = roomTasks.filter((task: Task) => {
      if (!task) return false
      const isCompleted = isTaskCompleted(task.completed)
      return isCompleted
    })
    
    console.log('[Dashboard] completedTasks calculation - TOTAL ROOM TASKS:', roomTasks.length)
    console.log('[Dashboard] completedTasks calculation - COMPLETED COUNT:', completed)
    console.log('[Dashboard] completedTasks calculation - COMPLETED TASKS LIST:', JSON.stringify(completedTasksList, null, 2))
    console.log('[Dashboard] completedTasks calculation - ALL TASKS WITH COMPLETION STATUS:', JSON.stringify(
      roomTasks.map(t => ({
        taskName: t.taskName,
        day: t.day,
        completed: t.completed,
        completedType: typeof t.completed,
        isCompletedCheck: isTaskCompleted(t.completed),
        room: t.room,
        roomKey: t.roomKey
      })), null, 2
    ))
    
    return completed
  }, [roomTasks])
  
  // FIXED: Calculate total from CONFIG, not from existing tasks in DB
  // This ensures we show 5/16 instead of 5/5 when only 5 tasks exist in DB
  const totalTasks = useMemo(() => {
    if (!config || !config.sections || !Array.isArray(config.sections)) {
      // Fallback to roomTasks length if no config
      return Array.isArray(roomTasks) ? roomTasks.length : 0
    }
    // Count all tasks from all sections in config
    let total = 0
    config.sections.forEach((section) => {
      if (section && section.tasks && Array.isArray(section.tasks)) {
        total += section.tasks.length
      }
    })
    return total
  }, [config, roomTasks])
  
  const completedTasksCount = completedTasks
  const pendingTasksCount = totalTasks - completedTasksCount
  const completionRate = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0
  
  console.log('[Dashboard] Overall statistics - ACTIVE ROOM:', activeRoomKey, activeRoomLabel)
  console.log('[Dashboard] Overall statistics - WEEK:', currentWeek)
  console.log('[Dashboard] Overall statistics - TOTAL FROM CONFIG:', totalTasks)
  console.log('[Dashboard] Overall statistics - TOTAL IN DB:', Array.isArray(roomTasks) ? roomTasks.length : 0)
  console.log('[Dashboard] Overall statistics - COMPLETED:', completedTasksCount)
  console.log('[Dashboard] Overall statistics - PENDING:', pendingTasksCount)
  console.log('[Dashboard] Overall statistics - COMPLETION RATE:', completionRate + '%')
  if (Array.isArray(roomTasks)) {
    const completed = roomTasks.filter(t => {
      const completedValue = t.completed as unknown
      const isCompleted = typeof completedValue === 'boolean' ? completedValue : 
                         typeof completedValue === 'string' ? completedValue.toLowerCase() === 'true' || completedValue === '1' :
                         typeof completedValue === 'number' ? completedValue === 1 : false
      return isCompleted
    })
    const pending = roomTasks.filter(t => {
      const completedValue = t.completed as unknown
      const isCompleted = typeof completedValue === 'boolean' ? completedValue : 
                         typeof completedValue === 'string' ? completedValue.toLowerCase() === 'true' || completedValue === '1' :
                         typeof completedValue === 'number' ? completedValue === 1 : false
      return !isCompleted
    })
    console.log('[Dashboard] Overall statistics - BREAKDOWN:', JSON.stringify({
      total: roomTasks.length,
      completed: completed.length,
      pending: pending.length,
      completedTasks: completed.map(t => ({ taskName: t.taskName, day: t.day, completed: t.completed })),
      pendingTasks: pending.map(t => ({ taskName: t.taskName, day: t.day, completed: t.completed }))
    }, null, 2))
  }
  // completionRate is now calculated above in the useMemo
  const pendingReminders = Array.isArray(reminders) ? reminders.filter((reminder) => reminder && !reminder.completed) : []
  const totalQuotes = Array.isArray(quotes) ? quotes.length : 0
  const approvedQuotes = Array.isArray(quotes) ? quotes.filter((q) => q && q.status === 'approved').length : 0
  const totalExpenses = Array.isArray(expenses) ? expenses.reduce((sum: number, expense) => sum + Number(expense?.amount ?? 0), 0) : 0

  // Pending tasks for the room
  const pendingTasks = useMemo(
    () => Array.isArray(roomTasks)
      ? roomTasks.filter((task: Task) => task && !isTaskCompleted(task.completed)).slice(0, 5)
      : [],
    [roomTasks]
  )

  // Recent completions for the room
  const recentCompletions = useMemo(
    () => Array.isArray(roomTasks)
      ? roomTasks.filter((task: Task) => task && isTaskCompleted(task.completed)).slice(-5).reverse()
      : [],
    [roomTasks]
  )

  // Day summaries filtered by room - FIXED: Use total from CONFIG, not just existing tasks
  const daySummaries = useMemo(() => {
    if (!Array.isArray(roomTasks)) return []
    
    // Calculate total tasks per day from CONFIG
    const getTotalTasksForDay = (dayNum: number): number => {
      if (!config || !config.sections || !Array.isArray(config.sections)) {
        // Fallback: count existing tasks if no config
        return roomTasks.filter((task: Task) => task && task.day === dayNum).length
      }
      // Count all tasks from all sections (all sections apply to all days)
      let total = 0
      config.sections.forEach((section) => {
        if (section && section.tasks && Array.isArray(section.tasks)) {
          total += section.tasks.length
        }
      })
      return total
    }
    
    const isTaskCompleted = (completedValue: unknown): boolean => {
      if (typeof completedValue === 'boolean') return completedValue
      if (typeof completedValue === 'string') return completedValue.toLowerCase() === 'true' || completedValue === '1'
      if (typeof completedValue === 'number') return completedValue === 1
      return false
    }
    
    return WORK_DAYS.map((day) => {
      const dayTasks = roomTasks.filter((task: Task) => task && task.day === day.num)
      const total = getTotalTasksForDay(day.num) // Use total from CONFIG
      const done = dayTasks.filter((task) => task && isTaskCompleted(task.completed)).length
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      return {
        ...day,
        total,
        done,
        pct,
      }
    })
  }, [roomTasks, config])

  const todaySummary = useMemo(() => {
    if (!daySummaries.length) return undefined
    const todayIndex = new Date().getDay()
    const dayNum = todayIndex === 0 ? 7 : todayIndex
    return daySummaries.find((day) => day.num === dayNum) ?? daySummaries[0]
  }, [daySummaries])

  const todayPendingCount = todaySummary ? Math.max(todaySummary.total - todaySummary.done, 0) : 0

  const handleRoomSelect = (key: string) => {
    setSelectedRoomKey(key)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_dashboard_room', key)
    }
    // Invalidate and refetch ALL task queries when room changes to avoid stale cache
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.refetchQueries({ queryKey: ['tasks'] })
  }

  const today = new Date()
  const dateFormatted = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric',
    month: 'long', 
    day: 'numeric' 
  })
  // Format time in 24-hour format manually to avoid locale issues
  const hours = today.getHours().toString().padStart(2, '0')
  const minutes = today.getMinutes().toString().padStart(2, '0')
  const timeFormatted = `${hours}:${minutes}`

  // Tab system for better organization
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'analytics' | 'activity'>('overview')

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'tasks' as const, label: 'Tasks', icon: Target },
    { id: 'analytics' as const, label: 'Analytics', icon: PieChart },
    { id: 'activity' as const, label: 'Activity', icon: Activity },
  ]

  return (
    <div className="min-h-screen space-y-6 pb-12">
      {/* Header with Tabs */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/50 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-900/95 p-4 shadow-2xl shadow-slate-950/50 sm:p-6 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-emerald-500/5" />
        <div className="relative">
          {/* Header */}
          <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary-400 animate-pulse" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-300/80">Bright Works Professional</p>
              </div>
              <h1 className="mb-1 text-2xl font-bold text-white sm:text-3xl md:text-4xl">Dashboard</h1>
              <p className="text-sm font-medium text-slate-300 sm:text-base">{dateFormatted}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-primary-500/30 bg-primary-500/10 px-2.5 py-1.5 backdrop-blur-sm shadow-lg shadow-primary-500/20 sm:px-3 sm:py-2 md:px-4 md:py-3">
                <CalendarIcon className="h-3.5 w-3.5 text-primary-300 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-semibold uppercase tracking-wide text-primary-200/70 sm:text-[9px] md:text-[10px]">Week</p>
                  <p className="text-sm font-bold text-white truncate sm:text-base md:text-lg">#{currentWeek}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 backdrop-blur-sm shadow-lg shadow-emerald-500/20 sm:px-3 sm:py-2 md:px-4 md:py-3">
                <Clock className="h-3.5 w-3.5 text-emerald-300 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-semibold uppercase tracking-wide text-emerald-200/70 sm:text-[9px] md:text-[10px]">Time</p>
                  <p className="text-sm font-bold text-white font-mono tracking-wider truncate sm:text-base md:text-xl">{timeFormatted}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="mb-4 flex gap-2 overflow-x-auto overscroll-x-contain sm:mb-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-200 touch-manipulation whitespace-nowrap',
                    'sm:px-4 sm:py-2.5 sm:text-sm md:px-5 md:py-3',
                    isActive
                      ? 'border-primary-500 bg-gradient-to-r from-primary-500/20 to-primary-600/20 text-primary-100 shadow-lg shadow-primary-500/20'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70'
                  )}
                  style={{ minHeight: '40px' }}
                >
                  <Icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5', isActive ? 'text-primary-300' : 'text-slate-400')} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.id === 'analytics' ? 'Stats' : tab.label.substring(0, 4)}</span>
                </button>
              )
            })}
          </div>

          {/* Room Selector - Responsive - Only show in Overview tab */}
          {activeTab === 'overview' && (
            <div className="mb-4 sm:mb-6">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 sm:mb-3 sm:text-xs">
                Select Room / Area
              </label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {availableRooms.map((room) => (
                  <button
                    key={room.key}
                    type="button"
                    onClick={() => handleRoomSelect(room.key)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all duration-200 touch-target',
                      'sm:px-3.5 sm:py-2 sm:text-xs md:px-4 md:py-2.5 md:text-sm',
                      room.key === activeRoomKey
                        ? 'border-primary-500 bg-primary-500/20 text-primary-100 shadow-lg shadow-primary-500/20'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70'
                    )}
                    style={{ minHeight: '36px', minWidth: '48px' }}
                  >
                    <MapPin className="mr-1.5 inline h-3 w-3 sm:mr-2 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                    <span className="whitespace-nowrap truncate max-w-[140px] sm:max-w-none">{room.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Performance Indicators - Responsive - FIXED JSX STRUCTURE 2024-12-07 */}
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="group relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/20 sm:rounded-2xl sm:p-5">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-emerald-500/10 blur-2xl sm:h-24 sm:w-24" />
                  <div className="relative">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg sm:mb-3 sm:h-12 sm:w-12">
                      <Target className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                    </div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">Room Completion</p>
                    <p className="mb-1 text-xl font-bold text-white sm:text-2xl">
                      {totalTasks > 0 ? `${completedTasksCount}/${totalTasks}` : '-'}
                    </p>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/50 sm:h-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-400 sm:text-xs">{completionRate}%</span>
                    </div>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-sky-600/5 p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/20 sm:rounded-2xl sm:p-5">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-sky-500/10 blur-2xl sm:h-24 sm:w-24" />
                  <div className="relative">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 shadow-lg sm:mb-3 sm:h-12 sm:w-12">
                      <Clock className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                    </div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs truncate">
                      {todaySummary?.fullName ?? 'Today'}
                    </p>
                    <p className="mb-1 text-xl font-bold text-white truncate sm:text-2xl">
                      {todaySummary && todaySummary.total > 0
                        ? `${todaySummary.done}/${todaySummary.total}`
                        : todaySummary
                          ? `${todaySummary.done}`
                          : '-'}
                    </p>
                    <p className="text-[10px] text-sky-300 truncate sm:text-xs">
                      {todaySummary?.pct ?? 0}% complete • {todayPendingCount} pending
                    </p>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/20 sm:rounded-2xl sm:p-5">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-amber-500/10 blur-2xl sm:h-24 sm:w-24" />
                  <div className="relative">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg sm:mb-3 sm:h-12 sm:w-12">
                      <Bell className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                    </div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">Reminders</p>
                    <p className="mb-1 text-xl font-bold text-white sm:text-2xl">{pendingReminders.length}</p>
                    <p className="text-[10px] text-amber-300 sm:text-xs">{reminders.length} total reminders</p>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/20 sm:rounded-2xl sm:p-5">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-purple-500/10 blur-2xl sm:h-24 sm:w-24" />
                  <div className="relative">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg sm:mb-3 sm:h-12 sm:w-12">
                      <DollarSign className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                    </div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">Financial</p>
                    <p className="mb-1 text-xl font-bold text-white truncate sm:text-2xl">${totalExpenses.toFixed(0)}</p>
                    <p className="text-[10px] text-purple-300 truncate sm:text-xs">{approvedQuotes}/{totalQuotes} quotes approved</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* END OVERVIEW TAB - NO SECTION TAG HERE - FIXED 2024-12-07-10:30 */}

          {activeTab === 'tasks' && (
            <>
      {/* Room Statistics - Responsive */}
      <section className="rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-500/5 to-primary-600/5 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6 lg:p-8">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 sm:h-10 sm:w-10">
              <MapPin className="h-4 w-4 text-primary-300 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-white truncate sm:text-lg">Room: {activeRoomLabel}</h2>
              <p className="text-[10px] text-slate-400 truncate sm:text-xs">Week {currentWeek} • {totalTasks} total tasks</p>
            </div>
          </div>
          <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 shadow-lg shadow-primary-500/20 sm:px-4 sm:py-2">
            <p className="text-[10px] font-semibold text-primary-200/70 sm:text-xs">Completion</p>
            <p className="text-base font-bold text-white sm:text-lg">{completionRate}%</p>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 sm:rounded-xl sm:p-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 sm:text-xs">Completed</p>
            <p className="text-xl font-bold text-white sm:text-2xl">{completedTasksCount}</p>
            <p className="mt-1 text-[10px] text-emerald-200/70 sm:text-xs">Tasks finished</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 sm:rounded-xl sm:p-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300 sm:text-xs">Pending</p>
            <p className="text-xl font-bold text-white sm:text-2xl">{pendingTasksCount}</p>
            <p className="mt-1 text-[10px] text-amber-200/70 sm:text-xs">Tasks remaining</p>
          </div>
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 sm:rounded-xl sm:p-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300 sm:text-xs">Total</p>
            <p className="text-xl font-bold text-white sm:text-2xl">{totalTasks}</p>
            <p className="mt-1 text-[10px] text-sky-200/70 sm:text-xs">All tasks</p>
          </div>
        </div>
      </section>

      {/* Tasks by Groups/Sections - Responsive */}
      {tasksBySection.length > 0 && (
        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6 lg:p-8">
          <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 sm:h-10 sm:w-10">
                <Target className="h-4 w-4 text-primary-300 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white truncate sm:text-lg">Tasks by Groups</h2>
                <p className="text-[10px] text-slate-400 truncate sm:text-xs">{activeRoomLabel} • {tasksBySection.length} groups</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tasksBySection.map((section) => {
              const isComplete = section.percentage === 100
              const sectionColors = {
                complete: 'border-emerald-500/30 bg-emerald-500/10',
                incomplete: 'border-amber-500/20 bg-amber-500/5',
                empty: 'border-slate-800/50 bg-slate-800/30',
              }
              const colorClass = isComplete 
                ? sectionColors.complete 
                : section.pending > 0 
                  ? sectionColors.incomplete 
                  : sectionColors.empty

              return (
                <div
                  key={section.id}
                  className={cn(
                    'group relative overflow-hidden rounded-lg border p-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg sm:rounded-xl sm:p-4 lg:p-5',
                    colorClass
                  )}
                >
                  {/* Status Badge - Responsive */}
                  {isComplete && (
                    <div className="absolute right-2 top-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-lg sm:right-3 sm:top-3 sm:px-2 sm:py-1 sm:text-[10px]">
                      ✓ Complete
                    </div>
                  )}

                  {/* Section Header - Responsive */}
                  <div className="mb-3 sm:mb-4">
                    <h3 className="mb-1 text-sm font-bold text-white truncate sm:text-base">{section.title}</h3>
                    <p className="text-[10px] text-slate-400 truncate sm:text-xs">
                      {section.completed}/{section.total} tasks completed
                    </p>
                  </div>

                  {/* Progress Bar - Responsive */}
                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-800/50 sm:mb-4 sm:h-3">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        isComplete
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : 'bg-gradient-to-r from-amber-500 to-amber-400'
                      )}
                      style={{ width: `${section.percentage}%` }}
                    />
                  </div>

                  {/* Statistics - Responsive */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    <div className="rounded-lg border border-slate-800/50 bg-slate-800/30 p-1.5 sm:p-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">Completed</p>
                      <p className={cn('text-base font-bold sm:text-lg', isComplete ? 'text-emerald-400' : 'text-slate-300')}>
                        {section.completed}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800/50 bg-slate-800/30 p-1.5 sm:p-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">Pending</p>
                      <p className={cn('text-base font-bold sm:text-lg', section.pending > 0 ? 'text-amber-400' : 'text-slate-300')}>
                        {section.pending}
                      </p>
                    </div>
                  </div>

                  {/* Percentage - Responsive */}
                  <div className="mt-2 text-center sm:mt-3">
                    <p className="text-xl font-bold text-white sm:text-2xl">{section.percentage}%</p>
                    <p className="text-[9px] text-slate-400 sm:text-[10px]">Completion Rate</p>
                  </div>

                  {/* Tasks by Day (Collapsible) - Responsive */}
                  {section.tasksByDay && section.tasksByDay.some(day => day.total > 0) && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-800/50 pt-2 sm:mt-4 sm:space-y-2 sm:pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">By Day</p>
                      <div className="grid grid-cols-5 gap-1">
                        {section.tasksByDay.map((day) => (
                          <div
                            key={day.day}
                            className={cn(
                              'rounded-md border p-1 text-center transition-all sm:rounded-lg sm:p-1.5',
                              day.completed === day.total && day.total > 0
                                ? 'border-emerald-500/30 bg-emerald-500/10'
                                : day.total > 0
                                  ? 'border-amber-500/20 bg-amber-500/5'
                                  : 'border-slate-800/50 bg-slate-800/30'
                            )}
                            title={`${day.dayName}: ${day.completed}/${day.total}`}
                          >
                            <p className="text-[8px] font-semibold text-slate-400 sm:text-[9px]">{day.dayName}</p>
                            <p className={cn('text-[10px] font-bold sm:text-xs', day.completed === day.total && day.total > 0 ? 'text-emerald-400' : 'text-slate-300')}>
                              {day.completed}/{day.total}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Weekly Progress Section - Responsive */}
      <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6 lg:p-8">
        <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 sm:h-10 sm:w-10">
              <BarChart3 className="h-4 w-4 text-primary-300 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-white truncate sm:text-lg">Weekly Progress by Day</h2>
              <p className="text-[10px] text-slate-400 truncate sm:text-xs">{activeRoomLabel} • Week {currentWeek}</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-1.5 sm:px-4 sm:py-2">
            <p className="text-[10px] font-semibold text-slate-400 sm:text-xs">Overall</p>
            <p className="text-base font-bold text-white sm:text-lg">{completionRate}%</p>
          </div>
        </div>

        <div className="grid gap-2 sm:gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {daySummaries.map((day) => {
            const isToday = todaySummary?.num === day.num
            return (
              <div
                key={day.num}
                className={cn(
                  'group relative overflow-hidden rounded-lg border p-3 transition-all duration-200 sm:rounded-xl sm:p-4',
                  isToday
                    ? 'border-primary-500/50 bg-primary-500/10 shadow-lg shadow-primary-500/20'
                    : day.pct === 100
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : day.pct === 0
                        ? 'border-slate-800/50 bg-slate-800/30'
                        : 'border-slate-800/50 bg-slate-800/30 hover:border-slate-700/50'
                )}
              >
                {isToday && (
                  <div className="absolute right-1.5 top-1.5 rounded-full bg-primary-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white sm:right-2 sm:top-2 sm:px-2 sm:text-[10px]">
                    Today
                  </div>
                )}
                <div className="mb-2 flex items-center justify-between sm:mb-3">
                  <p className={cn('text-xs font-bold truncate sm:text-sm', isToday ? 'text-primary-200' : 'text-white')}>
                    {day.name}
                  </p>
                  <span className={cn('text-xs font-bold sm:text-sm', day.pct === 100 ? 'text-emerald-400' : 'text-slate-400')}>
                    {day.pct}%
                  </span>
                </div>
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-800/50 sm:mb-3 sm:h-2">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      day.pct === 100
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : 'bg-gradient-to-r from-primary-500 to-primary-400'
                    )}
                    style={{ width: `${day.pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-xs">
                  <span className="text-slate-400">Tasks</span>
                  <span className="font-semibold text-slate-300">
                    {day.done}/{day.total}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Today's Activity - Simplified and Practical */}
      <section className="rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-500/5 to-primary-600/5 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-center justify-between sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 sm:h-10 sm:w-10">
              <CalendarIcon className="h-4 w-4 text-primary-300 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white sm:text-lg">Today's Activity</h2>
              <p className="text-[10px] text-slate-400 sm:text-xs">{todaySummary?.fullName || 'Today'} • {activeRoomLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
              <p className="text-[10px] font-semibold text-emerald-200/70 sm:text-xs">Completed</p>
              <p className="text-base font-bold text-emerald-300 sm:text-lg">{todaySummary?.done || 0}</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
              <p className="text-[10px] font-semibold text-amber-200/70 sm:text-xs">Pending</p>
              <p className="text-base font-bold text-amber-300 sm:text-lg">{todayPendingCount}</p>
            </div>
          </div>
        </div>
        
        {tasksLoading ? (
          <div className="py-6 text-center text-xs text-slate-400 sm:py-8 sm:text-sm">Loading tasks...</div>
        ) : todaySummary && todaySummary.total > 0 ? (
          <div className="space-y-2">
            {Array.isArray(roomTasks) && roomTasks
              .filter((task: Task) => task && task.day === todaySummary.num)
              .map((task: Task) => (
                <div
                  key={task._id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-3 transition-all duration-200 sm:rounded-xl sm:p-4',
                    task.completed
                      ? 'border-emerald-500/20 bg-emerald-500/10'
                      : 'border-amber-500/20 bg-amber-500/10'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 sm:h-10 sm:w-10',
                      task.completed ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                    )}>
                      {task.completed ? (
                        <CheckCircle className="h-4 w-4 text-emerald-300 sm:h-5 sm:w-5" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-300 sm:h-5 sm:w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate sm:text-base">{task.taskName}</p>
                      <p className="text-[10px] text-slate-400 truncate sm:text-xs">
                        {task.completed && task.updatedAt
                          ? `Completed ${new Date(task.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Pending'}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    'rounded-lg px-2 py-1 flex-shrink-0 sm:px-3',
                    task.completed ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                  )}>
                    <span className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide sm:text-xs',
                      task.completed ? 'text-emerald-300' : 'text-amber-300'
                    )}>
                      {task.completed ? 'Done' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 p-6 text-center sm:p-8">
            <p className="text-sm text-slate-400 sm:text-base">No tasks scheduled for today</p>
          </div>
        )}
      </section>

      {/* Main Content Grid - Responsive */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left Column - Tasks & Activities */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Pending Tasks - Responsive */}
          <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-600/5 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6">
            <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 sm:h-10 sm:w-10">
                <AlertCircle className="h-4 w-4 text-amber-400 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white truncate sm:text-lg">All Pending Tasks</h2>
                <p className="text-[10px] text-slate-400 truncate sm:text-xs">Remaining tasks for {activeRoomLabel}</p>
              </div>
              <div className="ml-auto rounded-full bg-amber-500/20 px-2 py-1 flex-shrink-0 sm:px-3">
                <span className="text-xs font-bold text-amber-300 sm:text-sm">{pendingTasks.length}</span>
              </div>
            </div>
            {tasksLoading ? (
              <div className="py-6 text-center text-xs text-slate-400 sm:py-8 sm:text-sm">Loading tasks...</div>
            ) : pendingTasks.length > 0 ? (
              <div className="space-y-1.5 sm:space-y-2">
                {pendingTasks.map((task) => (
                  <div
                    key={task._id}
                    className="group flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 transition-all duration-200 hover:border-amber-500/40 hover:bg-amber-500/15 sm:rounded-xl sm:p-4"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 sm:gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 flex-shrink-0 sm:h-8 sm:w-8">
                        <span className="text-[10px] font-bold text-amber-300 sm:text-xs">D{task.day}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate sm:text-base">{task.taskName}</p>
                        <p className="text-[10px] text-amber-200/70 truncate sm:text-xs">Week {task.week} • Day {task.day}</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-amber-500/20 px-2 py-1 flex-shrink-0 sm:px-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300 sm:text-xs">Pending</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-6 text-center sm:p-8">
                <CheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-400 sm:mb-3 sm:h-12 sm:w-12" />
                <p className="text-sm font-semibold text-emerald-300 sm:text-base">All tasks completed!</p>
                <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Excellent work on {activeRoomLabel}</p>
              </div>
            )}
          </section>

          {/* Recent Completions - Responsive */}
          <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6">
            <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 sm:h-10 sm:w-10">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white truncate sm:text-lg">Recent Completions</h2>
                <p className="text-[10px] text-slate-400 truncate sm:text-xs">Latest finished tasks</p>
              </div>
            </div>
            {recentCompletions.length > 0 ? (
              <div className="space-y-1.5 sm:space-y-2">
                {recentCompletions.map((task) => (
                  <div
                    key={task._id}
                    className="group flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 transition-all duration-200 hover:border-emerald-500/40 hover:bg-emerald-500/15 sm:rounded-xl sm:p-4"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 sm:gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 flex-shrink-0 sm:h-8 sm:w-8">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-300 sm:h-4 sm:w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate sm:text-base">{task.taskName}</p>
                        <p className="text-[10px] text-emerald-200/70 truncate sm:text-xs">
                          {new Date(task.updatedAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-500/20 px-2 py-1 flex-shrink-0 sm:px-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300 sm:text-xs">Done</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 p-6 text-center sm:p-8">
                <p className="text-xs text-slate-400 sm:text-sm">No completions yet this week</p>
              </div>
            )}
          </section>

          {/* Notes & Reminders Grid - Responsive */}
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6">
              <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 sm:h-10 sm:w-10">
                  <FileText className="h-4 w-4 text-primary-300 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-white truncate sm:text-lg">Notes</h2>
                  <p className="text-[10px] text-slate-400 truncate sm:text-xs">{notes.length} total</p>
                </div>
              </div>
              {notes.slice(0, 3).length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {notes.slice(0, 3).map((note: DashboardNote) => (
                    <div
                      key={note._id}
                      className="rounded-lg border border-slate-800/50 bg-slate-800/30 p-3 transition-all duration-200 hover:border-primary-500/30 hover:bg-slate-800/50 sm:rounded-xl sm:p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white truncate sm:text-sm">{note.title}</p>
                        <span className="text-[10px] text-slate-500 flex-shrink-0 sm:text-xs">
                          {new Date(note.createdAt).toLocaleDateString('en-US')}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[10px] text-slate-400 sm:text-xs">{note.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 p-4 text-center sm:p-6">
                  <p className="text-xs text-slate-500 sm:text-sm">No notes yet</p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-600/5 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6">
              <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 sm:h-10 sm:w-10">
                  <Bell className="h-4 w-4 text-amber-400 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-white truncate sm:text-lg">Reminders</h2>
                  <p className="text-[10px] text-slate-400 truncate sm:text-xs">{pendingReminders.length} pending</p>
                </div>
              </div>
              {pendingReminders.slice(0, 3).length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {pendingReminders.slice(0, 3).map((reminder: DashboardReminder) => (
                    <div
                      key={reminder._id}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 transition-all duration-200 hover:border-amber-500/40 hover:bg-amber-500/15 sm:rounded-xl sm:p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white truncate sm:text-sm">{reminder.title}</p>
                        <span className="text-[10px] text-amber-300 flex-shrink-0 sm:text-xs">
                          {new Date(reminder.dueDate).toLocaleDateString('en-US')}
                        </span>
                      </div>
                      {reminder.description && (
                        <p className="line-clamp-2 text-[10px] text-slate-300 sm:text-xs">{reminder.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 p-4 text-center sm:p-6">
                  <p className="text-xs text-slate-500 sm:text-sm">All clear!</p>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Right Sidebar - Responsive */}
        <aside className="space-y-4 sm:space-y-6">
          {/* Financial Summary - Responsive */}
          <section className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-600/5 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6">
            <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 sm:h-10 sm:w-10">
                <DollarSign className="h-4 w-4 text-purple-400 sm:h-5 sm:w-5" />
              </div>
              <h2 className="text-base font-bold text-white truncate sm:text-lg">Financial</h2>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3 sm:rounded-xl sm:p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-purple-300 sm:text-xs">Total Expenses</p>
                <p className="text-xl font-bold text-white truncate sm:text-2xl">${totalExpenses.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-slate-800/50 bg-slate-800/30 p-3 sm:rounded-xl sm:p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">Quotes Status</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-300 sm:text-sm">Approved</span>
                  <span className="text-base font-bold text-purple-300 sm:text-lg">
                    {approvedQuotes}/{totalQuotes}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/50 sm:h-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400"
                    style={{ width: totalQuotes > 0 ? `${(approvedQuotes / totalQuotes) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Customer Satisfaction Button */}
          <section className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="mb-1 text-base font-bold text-white sm:text-lg">Customer Satisfaction</h3>
                <p className="text-xs text-slate-400 sm:text-sm">Collect and track customer feedback</p>
              </div>
              <button
                onClick={() => setShowSatisfactionSurvey(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/40 bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-500"
              >
                <Star className="h-4 w-4" />
                New Survey
              </button>
            </div>
          </section>

          {/* QR Code Section - ANTES DEL ADMIN */}
          <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6">
            <PremiumQRCode value={typeof window !== 'undefined' ? window.location.origin : ''} />
          </section>

          {/* Quick Stats - Responsive */}
          <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30 sm:rounded-3xl sm:p-6">
            <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-600/10 sm:h-10 sm:w-10">
                <TrendingUp className="h-4 w-4 text-sky-400 sm:h-5 sm:w-5" />
              </div>
              <h2 className="text-base font-bold text-white truncate sm:text-lg">Quick Stats</h2>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-800/30 p-2.5 sm:p-3">
                <span className="text-xs text-slate-400 sm:text-sm">Total Tasks</span>
                <span className="text-base font-bold text-white sm:text-lg">{totalTasks}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-800/30 p-2.5 sm:p-3">
                <span className="text-xs text-slate-400 sm:text-sm">Completed</span>
                <span className="text-base font-bold text-emerald-400 sm:text-lg">{completedTasksCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-800/30 p-2.5 sm:p-3">
                <span className="text-xs text-slate-400 sm:text-sm">Pending</span>
                <span className="text-base font-bold text-amber-400 sm:text-lg">{pendingTasksCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-800/30 p-2.5 sm:p-3">
                <span className="text-xs text-slate-400 sm:text-sm">Completion Rate</span>
                <span className="text-base font-bold text-primary-300 sm:text-lg">{completionRate}%</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
            </>
          )}

          {activeTab === 'analytics' && (
            <>
      {/* Analytics Tab Content */}
      <div className="space-y-6">
        {/* Overall Performance Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Efficiency</span>
            </div>
            <p className="text-2xl font-bold text-white">{completionRate}%</p>
            <p className="text-xs text-slate-400">Overall completion rate</p>
          </div>
          
          <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-sky-600/5 p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20">
                <Target className="h-5 w-5 text-sky-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-sky-300">Tasks Done</span>
            </div>
            <p className="text-2xl font-bold text-white">{completedTasksCount}</p>
            <p className="text-xs text-slate-400">of {totalTasks} total tasks</p>
          </div>
          
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-300">Pending</span>
            </div>
            <p className="text-2xl font-bold text-white">{pendingTasksCount}</p>
            <p className="text-xs text-slate-400">tasks remaining</p>
          </div>
          
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
                <MapPin className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-300">Rooms</span>
            </div>
            <p className="text-2xl font-bold text-white">{availableRooms.length}</p>
            <p className="text-xs text-slate-400">active rooms</p>
          </div>
        </div>

        {/* Weekly Progress Chart */}
        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/20">
              <BarChart3 className="h-5 w-5 text-primary-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Weekly Progress</h3>
              <p className="text-xs text-slate-400">Task completion by day - Week {currentWeek}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {daySummaries.map((day) => (
              <div key={day.num} className="flex items-center gap-4">
                <div className="w-20 text-sm font-medium text-slate-300">{day.name}</div>
                <div className="flex-1">
                  <div className="h-8 overflow-hidden rounded-lg bg-slate-800/50">
                    <div
                      className={`h-full rounded-lg transition-all duration-500 ${
                        day.pct === 100 
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                          : day.pct > 50 
                            ? 'bg-gradient-to-r from-sky-500 to-sky-400'
                            : day.pct > 0
                              ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                              : 'bg-slate-700'
                      }`}
                      style={{ width: `${day.pct}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right">
                  <span className="text-sm font-bold text-white">{day.done}/{day.total}</span>
                </div>
                <div className="w-12 text-right">
                  <span className={`text-sm font-semibold ${
                    day.pct === 100 ? 'text-emerald-400' : day.pct > 50 ? 'text-sky-400' : 'text-amber-400'
                  }`}>{day.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section Performance */}
        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
              <PieChart className="h-5 w-5 text-purple-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Performance by Section</h3>
              <p className="text-xs text-slate-400">Completion rate per task group</p>
            </div>
          </div>
          
          {tasksBySection.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tasksBySection.map((section) => (
                <div 
                  key={section.id}
                  className={`rounded-xl border p-4 transition-all ${
                    section.percentage === 100 
                      ? 'border-emerald-500/30 bg-emerald-500/10' 
                      : 'border-slate-700/50 bg-slate-800/30'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white truncate">{section.title}</h4>
                    <span className={`text-lg font-bold ${
                      section.percentage === 100 ? 'text-emerald-400' : 'text-slate-300'
                    }`}>{section.percentage}%</span>
                  </div>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-700/50">
                    <div
                      className={`h-full rounded-full transition-all ${
                        section.percentage === 100 
                          ? 'bg-emerald-500' 
                          : 'bg-primary-500'
                      }`}
                      style={{ width: `${section.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">{section.completed}/{section.total} tasks</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 p-8 text-center">
              <p className="text-sm text-slate-400">No section data available</p>
            </div>
          )}
        </section>

        {/* Room Comparison */}
        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20">
              <MapPin className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Available Rooms</h3>
              <p className="text-xs text-slate-400">{availableRooms.length} rooms registered</p>
            </div>
          </div>
          
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {availableRooms.map((room) => (
              <div 
                key={room.key}
                onClick={() => handleRoomSelect(room.key)}
                className={`cursor-pointer rounded-xl border p-3 transition-all hover:scale-[1.02] ${
                  room.key === activeRoomKey 
                    ? 'border-primary-500 bg-primary-500/20 shadow-lg shadow-primary-500/20' 
                    : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-white truncate">{room.label}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Created {new Date(room.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
            </>
          )}

          {activeTab === 'activity' && (
            <>
      {/* Activity Tab Content */}
      <div className="space-y-6">
        {/* Activity Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{recentCompletions.length}</p>
                <p className="text-xs text-emerald-300">Completed Today</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
                <Clock className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pendingTasks.length}</p>
                <p className="text-xs text-amber-300">In Progress</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-sky-600/5 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/20">
                <Activity className="h-6 w-6 text-sky-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{completionRate}%</p>
                <p className="text-xs text-sky-300">Weekly Progress</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/20">
                <Activity className="h-5 w-5 text-primary-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Activity Timeline</h3>
                <p className="text-xs text-slate-400">Recent task completions - {activeRoomLabel}</p>
              </div>
            </div>
          </div>
          
          {recentCompletions.length > 0 ? (
            <div className="relative space-y-4">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 h-full w-0.5 bg-gradient-to-b from-emerald-500/50 via-slate-700/50 to-transparent" />
              
              {recentCompletions.map((task, index) => (
                <div key={task._id} className="relative flex gap-4 pl-2">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                    index === 0 
                      ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' 
                      : 'bg-slate-700 border border-emerald-500/30'
                  }`}>
                    <CheckCircle className={`h-4 w-4 ${index === 0 ? 'text-white' : 'text-emerald-400'}`} />
                  </div>
                  
                  {/* Activity content */}
                  <div className={`flex-1 rounded-xl border p-4 transition-all ${
                    index === 0 
                      ? 'border-emerald-500/30 bg-emerald-500/10' 
                      : 'border-slate-700/50 bg-slate-800/30'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white truncate">{task.taskName}</p>
                        <p className="text-xs text-slate-400">
                          Day {task.day} • Week {task.week} • {task.room || activeRoomLabel}
                        </p>
                      </div>
                      <div className="flex-shrink-0 rounded-lg bg-emerald-500/20 px-2 py-1">
                        <span className="text-xs font-semibold text-emerald-300">Completed</span>
                      </div>
                    </div>
                    {task.updatedAt && (
                      <p className="mt-2 text-xs text-slate-500">
                        {new Date(task.updatedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 p-8 text-center">
              <CheckCircle className="mx-auto mb-3 h-12 w-12 text-slate-600" />
              <p className="text-sm text-slate-400">No completed tasks yet</p>
              <p className="mt-1 text-xs text-slate-500">Complete tasks to see activity here</p>
            </div>
          )}
        </section>

        {/* Pending Tasks Activity */}
        <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-600/5 p-4 shadow-xl sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
              <AlertCircle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Pending Tasks</h3>
              <p className="text-xs text-slate-400">{pendingTasks.length} tasks waiting</p>
            </div>
          </div>
          
          {pendingTasks.length > 0 ? (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <div 
                  key={task._id}
                  className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 flex-shrink-0">
                      <Clock className="h-4 w-4 text-amber-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{task.taskName}</p>
                      <p className="text-xs text-amber-200/70">Day {task.day} • {task.room || activeRoomLabel}</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-500/20 px-2 py-1 flex-shrink-0">
                    <span className="text-xs font-semibold text-amber-300">Pending</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
              <CheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-300">All caught up!</p>
              <p className="mt-1 text-xs text-slate-400">No pending tasks for this room</p>
            </div>
          )}
        </section>

        {/* Daily Summary */}
        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 shadow-xl sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20">
              <CalendarIcon className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Daily Summary</h3>
              <p className="text-xs text-slate-400">Week {currentWeek} progress by day</p>
            </div>
          </div>
          
          <div className="grid gap-2 sm:grid-cols-5">
            {daySummaries.map((day) => {
              const isToday = todaySummary?.num === day.num
              return (
                <div 
                  key={day.num}
                  className={`rounded-xl border p-3 text-center transition-all ${
                    isToday 
                      ? 'border-primary-500/50 bg-primary-500/10 shadow-lg shadow-primary-500/20' 
                      : day.pct === 100
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-slate-700/50 bg-slate-800/30'
                  }`}
                >
                  {isToday && (
                    <div className="mb-1 rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Today
                    </div>
                  )}
                  <p className="text-sm font-bold text-white">{day.name}</p>
                  <p className={`text-2xl font-bold ${
                    day.pct === 100 ? 'text-emerald-400' : isToday ? 'text-primary-300' : 'text-slate-300'
                  }`}>{day.pct}%</p>
                  <p className="text-xs text-slate-400">{day.done}/{day.total}</p>
                </div>
              )
            })}
          </div>
        </section>
      </div>
            </>
          )}
        </div>
      </section>

      {showSatisfactionSurvey && (
        <CustomerSatisfactionSurvey onClose={() => setShowSatisfactionSurvey(false)} />
      )}
    </div>
  )
}