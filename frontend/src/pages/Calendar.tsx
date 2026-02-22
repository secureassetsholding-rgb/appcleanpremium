import { useEffect, useMemo, useRef, useState } from 'react'
import type { FocusEvent as ReactFocusEvent, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Bell,
  FileText,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { tasksService } from '../services/tasks'
import { apiClient } from '../services/api'
import type { Task, TimeRecord as TimeRecordEntry } from '../types'
import { loadNoteSchedules, NOTE_SCHEDULE_EVENT, NOTE_SCHEDULE_STORAGE_KEY } from '../lib/noteSchedule'

type Reminder = {
  _id: string
  title: string
  dueDate: string
  completed?: boolean
  description?: string
  priority?: 'low' | 'medium' | 'high'
}

type Note = {
  _id: string
  title: string
  createdAt: string
  content?: string
}

type TimeLog = {
  checkIn?: string
  checkOut?: string
  signature?: string
}

type TimeRecordMap = Record<number, TimeLog | null>

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function getIsoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getWeekKey(date: Date) {
  return `${date.getFullYear()}-W${getIsoWeek(date)}`
}

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

type MixedTimeRecord =
  | null
  | undefined
  | TimeLog
  | TimeLog[]
  | TimeRecordMap
  | TimeRecordEntry
  | Array<
      | TimeLog
      | TimeRecordMap
      | TimeRecordEntry
      | (Partial<TimeRecordEntry> & Partial<TimeLog> & { day?: number })
      | (Partial<TimeLog> & { day?: number })
    >
  | (Partial<Record<number, TimeLog | null>> & Partial<TimeRecordEntry>)

function extractTimeLogs(raw: MixedTimeRecord) {
  const logs: Array<TimeLog & { day: number }> = []
  if (!raw) return logs

  const pushLog = (day: number | undefined, payload?: TimeLog | null) => {
    if (!day || day < 1 || day > 7 || !payload) return
    logs.push({ day, checkIn: payload.checkIn, checkOut: payload.checkOut, signature: payload.signature })
  }

  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return
      const candidate = entry as Partial<TimeRecordEntry> & Partial<TimeLog> & { day?: number }
      pushLog(candidate.day, candidate as TimeLog)
    })
    return logs
  }

  if (typeof raw === 'object') {
    if ('day' in raw && typeof (raw as Record<string, unknown>).day === 'number') {
      const candidate = raw as TimeRecordEntry & TimeLog
      pushLog(candidate.day, candidate)
      return logs
    }

    Object.entries(raw as Record<string, TimeLog | null>).forEach(([key, value]) => {
      const day = Number(key)
      pushLog(Number.isNaN(day) ? undefined : day, value)
    })
  }

  return logs
}

function chunkArray<T>(source: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < source.length; index += size) {
    result.push(source.slice(index, index + size))
  }
  return result
}

type CalendarCell = {
  date: Date
  inCurrentMonth: boolean
}

function buildCalendarGrid(year: number, month: number): CalendarCell[][] {
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const leadingDays = firstDayOfMonth.getDay()
  const totalDays = lastDayOfMonth.getDate()

  const cells: CalendarCell[] = []

  for (let index = 0; index < leadingDays; index += 1) {
    const date = new Date(year, month, index - leadingDays + 1)
    cells.push({ date, inCurrentMonth: false })
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ date: new Date(year, month, day), inCurrentMonth: true })
  }

  const trailingCells = (7 - (cells.length % 7 || 7)) % 7
  for (let index = 1; index <= trailingCells; index += 1) {
    cells.push({ date: new Date(year, month + 1, index), inCurrentMonth: false })
  }

  return chunkArray(cells, 7)
}

function formatTime(value?: string) {
  if (!value) return null
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return formatter.format(new Date(value))
  } catch {
    return null
  }
}

function normalizeDayIndex(date: Date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const currentWeekNumber = useMemo(() => getIsoWeek(new Date()), [])
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const currentWeekKey = useMemo(() => getWeekKey(new Date()), [])
  const [noteSchedules, setNoteSchedules] = useState(() => loadNoteSchedules())
  const [detailPopover, setDetailPopover] = useState<{
    key: string
    top: number
    left: number
    date: Date
  } | null>(null)
  const hideDetailTimeout = useRef<number | null>(null)

  const { data: tasksRaw = [] } = useQuery({
    queryKey: ['tasks', currentWeekNumber, currentYear],
    queryFn: () => tasksService.getTasks(currentWeekNumber),
  })

  const tasks = useMemo(() => {
    if (!Array.isArray(tasksRaw)) return []
    return tasksRaw.filter((task): task is Task => Boolean(task))
  }, [tasksRaw])

  const { data: timeRecords = [] } = useQuery({
    queryKey: ['timeRecords', currentWeekNumber, currentYear],
    queryFn: () => tasksService.getTimeRecords(currentWeekNumber),
  })
  const timeLogs = useMemo(() => extractTimeLogs(timeRecords as unknown as MixedTimeRecord), [timeRecords])

  const { data: remindersRaw = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<Reminder[]>('/api/reminders')
        return Array.isArray(result) ? result : []
      } catch {
        return []
      }
    },
  })

  const reminders = useMemo(() => {
    if (!Array.isArray(remindersRaw)) return []
    return remindersRaw.filter((reminder): reminder is Reminder => Boolean(reminder))
  }, [remindersRaw])

  const { data: notesRaw = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<Note[]>('/api/notes')
        return Array.isArray(result) ? result : []
      } catch {
        return []
      }
    },
  })

  const notes = useMemo(() => {
    if (!Array.isArray(notesRaw)) return []
    return notesRaw.filter((note): note is Note => Boolean(note))
  }, [notesRaw])

  useEffect(() => {
    const refreshSchedules = () => setNoteSchedules(loadNoteSchedules())
    const handleStorage = (event: StorageEvent) => {
      if (event.key === NOTE_SCHEDULE_STORAGE_KEY) {
        refreshSchedules()
      }
    }
    window.addEventListener(NOTE_SCHEDULE_EVENT, refreshSchedules as EventListener)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(NOTE_SCHEDULE_EVENT, refreshSchedules as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const month = currentDate.getMonth()
  const year = currentDate.getFullYear()

  const weeks = useMemo(() => buildCalendarGrid(year, month), [year, month])

  const remindersByDate = useMemo(() => {
    const map = new Map<string, Reminder[]>()
    if (!Array.isArray(reminders)) return map
    reminders.forEach((reminder) => {
      if (!reminder?.dueDate) return
      const reminderDate = new Date(reminder.dueDate)
      if (Number.isNaN(reminderDate.getTime())) return
      const key = formatDateKey(reminderDate)
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(reminder)
    })
    return map
  }, [reminders])

  const completedTasksByDay = useMemo(() => {
    const grouped = new Map<number, Task[]>()
    if (!Array.isArray(tasks)) return grouped
    tasks
      .filter((task) => task && task.week === currentWeekNumber)
      .filter((task) => task && task.completed)
      .forEach((task) => {
        if (!task || !task.day) return
        if (!grouped.has(task.day)) {
          grouped.set(task.day, [])
        }
        grouped.get(task.day)!.push(task)
      })
    return grouped
  }, [tasks, currentWeekNumber])

  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>()
    if (!Array.isArray(notes)) return map
    notes
      .filter((note) => note && Boolean(note?.createdAt))
      .forEach((note) => {
        if (!note) return
        const scheduled = noteSchedules[note._id] ?? note.createdAt
        const date = new Date(scheduled)
        if (Number.isNaN(date.getTime())) return
        const key = formatDateKey(date)
        if (!map.has(key)) {
          map.set(key, [])
        }
        map.get(key)!.push(note)
      })
    return map
  }, [notes, noteSchedules])

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const isToday = (candidate: Date) => {
    const now = new Date()
    return (
      candidate.getFullYear() === now.getFullYear() &&
      candidate.getMonth() === now.getMonth() &&
      candidate.getDate() === now.getDate()
    )
  }

  const getTimeLogForDate = (date: Date): TimeLog | null => {
    const day = normalizeDayIndex(date)
    if (day < 1 || day > 5) return null
    const dateWeekKey = getWeekKey(date)
    if (dateWeekKey !== currentWeekKey) return null

    return timeLogs.find((log) => log.day === day) ?? null
  }

  const getRemindersForDate = (date: Date): number => {
    const key = formatDateKey(date)
    return remindersByDate.get(key)?.filter((item) => !item.completed).length ?? 0
  }

  const getNotesCountForDate = (date: Date) => {
    const key = formatDateKey(date)
    return notesByDate.get(key)?.length ?? 0
  }

  const clearDetailHide = () => {
    if (hideDetailTimeout.current !== null) {
      window.clearTimeout(hideDetailTimeout.current)
      hideDetailTimeout.current = null
    }
  }

  const scheduleDetailHide = () => {
    clearDetailHide()
    hideDetailTimeout.current = window.setTimeout(() => {
      setDetailPopover(null)
    }, 120)
  }

  const showDetailPopover = (
    event: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement> | ReactFocusEvent<HTMLDivElement>,
    date: Date
  ) => {
    clearDetailHide()
    const target = event.currentTarget
    const rect = target.getBoundingClientRect()
    const scrollX = window.scrollX || window.pageXOffset
    const scrollY = window.scrollY || window.pageYOffset
    const centerX = rect.left + rect.width / 2 + scrollX
    const top = rect.bottom + scrollY + 12
    const popoverWidth = 360
    const viewportWidth = document.documentElement.clientWidth
    const minX = popoverWidth / 2 + 16
    const maxX = viewportWidth - popoverWidth / 2 - 16
    const left = Math.min(Math.max(centerX, minX), maxX)
    setDetailPopover({
      key: formatDateKey(date),
      top,
      left,
      date,
    })
  }

  const getCompletedTasksCount = (date: Date) => {
    const day = normalizeDayIndex(date)
    if (day < 1 || day > 5) return 0
    if (date.getFullYear() !== currentYear) return 0
    if (getIsoWeek(date) !== currentWeekNumber) return 0
    return completedTasksByDay.get(day)?.length ?? 0
  }

  useEffect(() => {
    return () => {
      clearDetailHide()
    }
  }, [])

  const detailReminders = detailPopover ? remindersByDate.get(detailPopover.key) ?? [] : []
  const detailNotes = detailPopover ? notesByDate.get(detailPopover.key) ?? [] : []
  const detailTimeLog = detailPopover ? getTimeLogForDate(detailPopover.date) : null
  const detailCompletedCount = detailPopover ? getCompletedTasksCount(detailPopover.date) : 0

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <CalendarIcon className="h-8 w-8 text-primary-400" />
            Calendar overview
          </h1>
          <p className="text-sm text-slate-400">
            Monitor completed tasks, time logs, reminders, and notes for every day of the month.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevMonth}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-primary-500/50 hover:text-primary-200"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-[180px] text-center text-xl font-semibold text-white">
            {MONTH_LABELS[month]} {year}
          </div>
          <button
            onClick={handleNextMonth}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-primary-500/50 hover:text-primary-200"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-900/20">
        <div className="mb-3 hidden gap-2 border-b border-slate-800 pb-3 text-sm font-semibold text-slate-400 sm:grid sm:grid-cols-7">
          {DAY_LABELS.map((label) => (
            <div key={label} className="text-center uppercase tracking-wide">
              {label}
            </div>
          ))}
        </div>
        <div className="-mx-4 overflow-x-auto px-2 pb-2 sm:mx-0 sm:px-0">
          <div className="min-w-[720px] space-y-2 sm:min-w-0">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-2">
                {week.map(({ date, inCurrentMonth }) => {
                  const today = isToday(date)
                  const timeLog = getTimeLogForDate(date)
                  const completedCount = getCompletedTasksCount(date)
                  const remindersCount = getRemindersForDate(date)
                  const notesCount = getNotesCountForDate(date)

                  const baseClasses = 'rounded-xl border p-3 transition duration-200 ease-out min-h-[110px] flex flex-col gap-2'
                  const visualStyles = today
                    ? 'border-primary-500/60 bg-primary-500/10 shadow-lg shadow-primary-500/20'
                    : inCurrentMonth
                    ? 'border-slate-700 bg-slate-800/70 hover:border-primary-500/40 hover:bg-slate-800'
                    : 'border-slate-800/80 bg-slate-900/40 text-slate-500'

                  return (
                    <div
                      key={date.toISOString()}
                      className={`${baseClasses} ${visualStyles} touch-manipulation cursor-pointer`}
                      onMouseEnter={(event) => showDetailPopover(event, date)}
                      onMouseLeave={scheduleDetailHide}
                      onFocus={(event) => showDetailPopover(event, date)}
                      onBlur={scheduleDetailHide}
                      onTouchStart={(event) => {
                        showDetailPopover(event, date)
                      }}
                      onClick={(event) => {
                        showDetailPopover(event, date)
                      }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className={`font-semibold ${today ? 'text-primary-200' : 'text-white'}`}>{date.getDate()}</span>
                        {completedCount > 0 && (
                          <span className="rounded-full bg-green-500/20 px-2 py-[1px] text-xs font-semibold text-green-300">
                            {completedCount}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-xs">
                        {timeLog && (
                          <div className="space-y-0.5 text-slate-300">
                            {formatTime(timeLog.checkIn) && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span className="truncate">In: {formatTime(timeLog.checkIn)}</span>
                              </div>
                            )}
                            {formatTime(timeLog.checkOut) && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span className="truncate">Out: {formatTime(timeLog.checkOut)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {completedCount > 0 && (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span className="truncate">{completedCount} tasks</span>
                          </div>
                        )}

                        {remindersCount > 0 && (
                          <div className="flex items-center gap-1 text-amber-300">
                            <Bell className="h-3 w-3" />
                            <span className="truncate">{remindersCount} reminder{remindersCount > 1 ? 's' : ''}</span>
                          </div>
                        )}

                        {notesCount > 0 && (
                          <div className="flex items-center gap-1 text-blue-300">
                            <FileText className="h-3 w-3" />
                            <span className="truncate">{notesCount} note{notesCount > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-900/20">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-green-500/40 bg-green-500/10 text-green-200">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">Completed tasks</p>
              <p className="text-2xl font-semibold text-white">{Array.isArray(tasks) ? tasks.filter((task) => task && task.completed).length : 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-900/20">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary-500/40 bg-primary-500/10 text-primary-200">
              <Clock className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">Days with check-in</p>
              <p className="text-2xl font-semibold text-white">
                {Array.isArray(timeLogs) ? timeLogs.filter((log) => log?.checkIn).length : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-900/20">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-200">
              <CalendarIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">Current week</p>
              <p className="text-2xl font-semibold text-white">Week {currentWeekNumber}</p>
            </div>
          </div>
        </div>
      </div>
      {detailPopover && (
        <div
          className="fixed z-[50] w-[min(360px,calc(100vw-32px))] -translate-x-1/2 touch-manipulation"
          style={{ top: detailPopover.top, left: detailPopover.left }}
          onMouseEnter={clearDetailHide}
          onMouseLeave={scheduleDetailHide}
          onTouchStart={clearDetailHide}
        >
          <div className="pointer-events-auto rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/60 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Day detail</p>
                <p className="text-lg font-semibold text-white">
                  {new Intl.DateTimeFormat('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }).format(detailPopover.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailPopover(null)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              {detailReminders.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                    <Bell className="h-4 w-4" /> Reminders
                  </p>
                  <ul className="space-y-2">
                    {detailReminders.map((reminder) => {
                      const dueDate = new Date(reminder.dueDate)
                      return (
                        <li
                          key={reminder._id}
                          className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3"
                        >
                          <p className="font-semibold text-amber-100">{reminder.title}</p>
                          <p className="text-xs text-amber-200/80">
                            {dueDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            {reminder.priority ? ` · Priority: ${reminder.priority}` : ''}
                          </p>
                          {reminder.description && (
                            <p className="mt-1 text-xs text-amber-100/90 whitespace-pre-wrap">
                              {reminder.description}
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {detailNotes.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-blue-300">
                    <FileText className="h-4 w-4" /> Notes
                  </p>
                  <ul className="space-y-2">
                    {detailNotes.map((note) => (
                      <li key={note._id} className="rounded-lg border border-primary-400/30 bg-primary-500/10 p-3">
                        <p className="font-semibold text-primary-100">{note.title}</p>
                        {note.content && (
                          <p className="mt-1 text-xs text-primary-100/90 whitespace-pre-wrap">{note.content}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detailTimeLog && (
                <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-slate-200">
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary-200">
                    <Clock className="h-4 w-4" /> Time Log
                  </p>
                  {formatTime(detailTimeLog.checkIn) && <p>Check-In: {formatTime(detailTimeLog.checkIn)}</p>}
                  {formatTime(detailTimeLog.checkOut) && <p>Check-Out: {formatTime(detailTimeLog.checkOut)}</p>}
                  {detailTimeLog.signature && <p>Signature captured</p>}
                </div>
              )}

              {detailCompletedCount > 0 && (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-emerald-100">
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Completed tasks: {detailCompletedCount}
                  </p>
                  <p className="text-xs text-emerald-200/80">Open the Schedule module to review full details.</p>
                </div>
              )}

              {detailReminders.length === 0 &&
                detailNotes.length === 0 &&
                !detailTimeLog &&
                detailCompletedCount === 0 && (
                  <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">
                    No events recorded for this date.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
