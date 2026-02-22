import { useEffect, useMemo, useState, useRef } from 'react'
import { TimeRecord, Task, TaskConfig } from '../types'
import { SignaturePad } from './SignaturePad'
import { PenTool, Building2, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '../contexts/AuthContext'

interface AttendanceTableProps {
  week: number
  timeRecords?: TimeRecord[]
  onDaySigned?: (day: number, signature: string, observations?: string) => void
  onTimeUpdate?: (day: number, payload: { checkIn?: string; checkOut?: string; room?: string; employeeName?: string; observations?: string }) => Promise<void>
  tasks?: Task[]
  config?: TaskConfig
  activeRoomLabel?: string
  activeRoomKey?: string
}

const WORK_DAYS = [
  { num: 1, name: 'Mon', fullName: 'Monday' },
  { num: 2, name: 'Tue', fullName: 'Tuesday' },
  { num: 3, name: 'Wed', fullName: 'Wednesday' },
  { num: 4, name: 'Thu', fullName: 'Thursday' },
  { num: 5, name: 'Fri', fullName: 'Friday' },
]

const buildRoomStorageKey = (week: number, roomKey?: string) => {
  const normalized = typeof roomKey === 'string' && roomKey.trim().length > 0 ? roomKey.trim().toLowerCase() : 'general'
  return `brightworks_room_week_${week}_${normalized}`
}

export function AttendanceTable({
  week,
  timeRecords = [],
  onDaySigned,
  onTimeUpdate,
  tasks = [],
  config,
  activeRoomLabel,
  activeRoomKey,
}: AttendanceTableProps) {
  const { user } = useAuth()
  const [signatureDay, setSignatureDay] = useState<number | null>(null)
  const [daySignatures, setDaySignatures] = useState<Record<string, string>>({})
  const [room, setRoom] = useState(() => {
    if (typeof window === 'undefined') return activeRoomLabel || ''
    const storageKey = buildRoomStorageKey(week, activeRoomKey)
    const stored = localStorage.getItem(storageKey)
    if (stored && stored.trim().length > 0) {
      return stored
    }
    return activeRoomLabel || ''
  })
  const [employeeName, setEmployeeName] = useState(() => localStorage.getItem(`brightworks_employee_name_week_${week}`) || user?.fullName || user?.username || '')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [savingDay, setSavingDay] = useState<number | null>(null)
  const [timeInputs, setTimeInputs] = useState<Record<number, { checkIn: string; checkOut: string }>>({})
  
  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const normalizedTimeRecords = useMemo(() => {
    if (!timeRecords) return []
    if (Array.isArray(timeRecords)) return timeRecords
    if (typeof timeRecords === 'object') {
      return Object.values(timeRecords).filter((value): value is TimeRecord => Boolean(value))
    }
    return []
  }, [timeRecords])

  const timeRecordMap = useMemo(() => {
    return normalizedTimeRecords.reduce<Record<number, TimeRecord>>((acc, record) => {
      if (record?.day) {
        acc[record.day] = record
      }
      return acc
    }, {})
  }, [normalizedTimeRecords])

  useEffect(() => {
    setTimeInputs(() => {
      const base: Record<number, { checkIn: string; checkOut: string }> = {}
      WORK_DAYS.forEach((day) => {
        const record = timeRecordMap[day.num]
        base[day.num] = {
          checkIn: toInputValue(record?.checkIn),
          checkOut: toInputValue(record?.checkOut),
        }
      })
      return base
    })
  }, [timeRecordMap])

  const isDayCompleted = (day: number): boolean => {
    if (!config || !tasks.length) return false
    const allSectionTasks = config.sections.flatMap((section) => section.tasks)
    const dayTasks = tasks.filter((task) => task.day === day && allSectionTasks.includes(task.taskName))
    const requiredTasks = allSectionTasks.length
    const completedTasks = dayTasks.filter((task) => task.completed).length
    return requiredTasks > 0 && completedTasks === requiredTasks
  }

  const handleSignatureSave = (day: number, signature: string, observations?: string) => {
    setDaySignatures((prev) => ({ ...prev, [`${day}-${week}`]: signature }))
    // Store observations in localStorage for persistence
    if (observations) {
      localStorage.setItem(`brightworks_observations_${week}_${day}_${activeRoomKey || 'general'}`, observations)
    }
    onDaySigned?.(day, signature, observations)
    setSignatureDay(null)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = buildRoomStorageKey(week, activeRoomKey)
    const stored = localStorage.getItem(storageKey)
    if (stored && stored.trim().length > 0) {
      setRoom(stored)
    } else if (activeRoomLabel) {
      setRoom(activeRoomLabel)
    } else {
      setRoom('')
    }
  }, [week, activeRoomKey, activeRoomLabel])

  const handleRoomChange = (value: string) => {
    setRoom(value)
    if (typeof window !== 'undefined') {
      const storageKey = buildRoomStorageKey(week, activeRoomKey)
      localStorage.setItem(storageKey, value)
    }
  }
  
  const handleEmployeeNameChange = (value: string) => {
    setEmployeeName(value)
    localStorage.setItem(`brightworks_employee_name_week_${week}`, value)
  }
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const toInputValue = (value?: string | null) => {
    if (!value) return ''
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    }
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      const [hours, minutes] = value.split(':')
      return `${hours.padStart(2, '0')}:${minutes}`
    }
    return ''
  }

  const toISOStringTime = (value: string) => {
    if (!/^\d{1,2}:\d{2}$/.test(value)) return undefined
    const [hoursRaw, minutesRaw] = value.split(':')
    const hours = Number(hoursRaw)
    const minutes = Number(minutesRaw)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    return date.toISOString()
  }

  const handleTimeChange = (day: number, field: 'checkIn' | 'checkOut', value: string) => {
    setTimeInputs((prev) => ({
      ...prev,
      [day]: {
        checkIn: field === 'checkIn' ? value : prev[day]?.checkIn ?? '',
        checkOut: field === 'checkOut' ? value : prev[day]?.checkOut ?? '',
      },
    }))
  }

  const handleTimeBlur = async (day: number) => {
    if (!onTimeUpdate) return
    const payload = timeInputs[day]
    if (!payload) return
    const payloadToSend: { checkIn?: string; checkOut?: string; room?: string; employeeName?: string } = {}
    const checkInISO = payload.checkIn ? toISOStringTime(payload.checkIn) : undefined
    const checkOutISO = payload.checkOut ? toISOStringTime(payload.checkOut) : undefined
    if (checkInISO) payloadToSend.checkIn = checkInISO
    if (checkOutISO) payloadToSend.checkOut = checkOutISO
    if (activeRoomLabel) {
      payloadToSend.room = activeRoomLabel
    } else if (room) {
      payloadToSend.room = room
    }
    if (employeeName) payloadToSend.employeeName = employeeName
    if (Object.keys(payloadToSend).length === 0) return
    setSavingDay(day)
    try {
      await onTimeUpdate(day, payloadToSend)
    } finally {
      setSavingDay((current) => (current === day ? null : current))
    }
  }
  
  // Update room and employeeName when they change (debounced) - only sync when values actually change
  const prevRoomRef = useRef<string>(room)
  const prevEmployeeNameRef = useRef<string>(employeeName)
  const isInitialMount = useRef<boolean>(true)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  
  // Keep ref updated
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
  }, [onTimeUpdate])
  
  useEffect(() => {
    if (!onTimeUpdateRef.current) return
    
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      prevRoomRef.current = room
      prevEmployeeNameRef.current = employeeName
      return
    }
    
    // Only sync if values actually changed
    const roomChanged = room !== prevRoomRef.current
    const employeeNameChanged = employeeName !== prevEmployeeNameRef.current
    
    if (!roomChanged && !employeeNameChanged) {
      return
    }
    
    const timeoutId = setTimeout(() => {
      // Double-check values still changed (in case of rapid changes)
      if (room !== prevRoomRef.current || employeeName !== prevEmployeeNameRef.current) {
        // Send room and employeeName for all days when they change
        WORK_DAYS.forEach((day) => {
          const payload: { room?: string; employeeName?: string } = {}
          if (activeRoomLabel) {
            payload.room = activeRoomLabel
          } else if (room) {
            payload.room = room
          }
          if (employeeName) payload.employeeName = employeeName
          onTimeUpdateRef.current?.(day.num, payload).catch(() => {
            // Silently fail - this is just for syncing room/name
          })
        })
        prevRoomRef.current = room
        prevEmployeeNameRef.current = employeeName
      }
    }, 1500) // Increased debounce to 1.5 seconds to reduce API calls
    
    return () => clearTimeout(timeoutId)
  }, [room, employeeName]) // Only depend on room and employeeName to prevent constant re-runs

  return (
    <div className="isolate w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/40">
      <div className="border-b border-slate-800 bg-slate-900/80 px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-3">
        <div className="flex flex-col gap-1.5 sm:gap-2 sm:flex-row sm:items-center sm:justify-between md:gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white sm:text-base md:text-lg">Daily Attendance</h3>
            <p className="text-[9px] text-slate-500 sm:text-[10px] md:text-xs">Digital signatures and premium time tracking</p>
            {activeRoomLabel && (
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-200/80 sm:text-[10px] md:text-xs">
                Room · {activeRoomLabel}
              </p>
            )}
          </div>
          <div className="flex w-full flex-col gap-1 sm:max-w-[180px] md:max-w-[200px]">
            <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-300 sm:text-[10px]">Employee Name</label>
            <input
              value={employeeName}
              onChange={(event) => handleEmployeeNameChange(event.target.value)}
              placeholder="Employee name"
              className="w-full rounded-md border border-sky-200/50 bg-gradient-to-r from-sky-300 via-sky-400 to-sky-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-900 placeholder:text-slate-700 shadow-md shadow-sky-500/30 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300/40 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-xs"
            />
          </div>
        </div>
      </div>
      
      {/* Premium Clock Display */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-sky-500/10 via-sky-400/10 to-sky-500/10 px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-3">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:gap-3">
          <Clock className="h-3.5 w-3.5 text-sky-400 animate-pulse sm:h-4 sm:w-4 md:h-5 md:w-5" />
          <div className="text-center">
            <div className="text-lg font-bold text-sky-300 sm:text-xl md:text-2xl font-mono tracking-wider">
              {formatTime(currentTime)}
            </div>
            <div className="text-[9px] text-sky-400/80 mt-0.5 uppercase tracking-wide sm:text-[10px] md:text-xs">
              {formatDate(currentTime)}
            </div>
          </div>
          <Clock className="h-3.5 w-3.5 text-sky-400 animate-pulse sm:h-4 sm:w-4 md:h-5 md:w-5" />
        </div>
      </div>

      <div className="-webkit-overflow-scrolling-touch overflow-x-auto">
        <table className="w-full table-auto sm:table-fixed" role="grid">
          <colgroup>
            <col className="w-[100px] sm:w-[120px] md:w-[140px]" />
            {WORK_DAYS.map(() => (
              <col key={crypto.randomUUID()} className="min-w-[70px] sm:min-w-[80px] md:min-w-[100px]" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-r border-slate-800 bg-slate-900/90 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-300 sm:px-2.5 sm:py-2 sm:text-xs md:px-3 md:text-sm">
                Day
              </th>
              {WORK_DAYS.map((day) => (
                <th
                  key={day.num}
                  className="border-b border-slate-800 bg-slate-900/80 px-1.5 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:px-2 sm:py-2 sm:text-[10px] md:text-xs"
                >
                  <span className="hidden sm:inline">{day.fullName}</span>
                  <span className="sm:hidden">{day.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sticky left-0 z-10 border-r border-t border-slate-800 bg-slate-900/90 px-2 py-2 sm:px-2.5 sm:py-2.5 md:px-3 md:py-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Building2 className="h-3 w-3 text-primary-300 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                  <input
                    value={room}
                    onChange={(event) => handleRoomChange(event.target.value)}
                    placeholder="Area / Room"
                    className="w-full rounded-md border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-200 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs md:text-sm"
                  />
                </div>
              </td>
              {WORK_DAYS.map((day) => (
                <td key={day.num} className="border-r border-t border-slate-800 bg-slate-900/60 px-1.5 py-2 text-center text-[10px] text-slate-400 sm:px-2 sm:py-2.5 sm:text-xs md:text-sm">
                  {room || '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-0 z-10 border-r border-t border-slate-800 bg-slate-900/90 px-2 py-2 text-[10px] font-semibold text-slate-200 sm:px-2.5 sm:py-2.5 sm:text-xs md:px-3 md:text-sm">
                Check in
              </td>
              {WORK_DAYS.map((day) => (
                <td key={day.num} className="border-r border-t border-slate-800 bg-slate-900/60 px-1.5 py-2 sm:px-2 sm:py-2.5">
                  <div className="relative">
                    <input
                      type="time"
                      value={timeInputs[day.num]?.checkIn ?? ''}
                      onChange={(event) => handleTimeChange(day.num, 'checkIn', event.target.value)}
                      onBlur={() => handleTimeBlur(day.num)}
                      className="w-full rounded-md border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs md:text-sm"
                    />
                    {savingDay === day.num && (
                      <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-primary-300" />
                    )}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-0 z-10 border-r border-t border-slate-800 bg-slate-900/90 px-3 py-3 text-xs font-semibold text-slate-200 sm:text-sm">
                Check out
              </td>
              {WORK_DAYS.map((day) => (
                <td key={day.num} className="border-r border-t border-slate-800 bg-slate-900/60 px-2 py-3">
                  <div className="relative">
                    <input
                      type="time"
                      value={timeInputs[day.num]?.checkOut ?? ''}
                      onChange={(event) => handleTimeChange(day.num, 'checkOut', event.target.value)}
                      onBlur={() => handleTimeBlur(day.num)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:text-sm"
                    />
                    {savingDay === day.num && (
                      <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-primary-300" />
                    )}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-0 z-10 border-r border-t border-slate-800 bg-slate-900/90 px-3 py-3 text-xs font-semibold text-slate-200 sm:text-sm">
                Signature
              </td>
              {WORK_DAYS.map((day) => {
                const completed = isDayCompleted(day.num)
                const hasSignature = daySignatures[`${day.num}-${week}`] || timeRecordMap[day.num]?.signature

                return (
                  <td key={day.num} className="border-r border-t border-slate-800 bg-slate-900/60 px-2 py-3">
                    {signatureDay === day.num ? (
                      <SignaturePad 
                        onSave={(signature, observations) => handleSignatureSave(day.num, signature, observations)} 
                        onCancel={() => setSignatureDay(null)}
                        initialObservations={localStorage.getItem(`brightworks_observations_${week}_${day.num}_${activeRoomKey || 'general'}`) || timeRecordMap[day.num]?.observations || ''}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => completed && setSignatureDay(day.num)}
                        disabled={!completed}
                        className={cn(
                          'flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold transition-all sm:text-sm',
                          completed
                            ? hasSignature
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30'
                              : 'bg-gradient-to-r from-primary-500 via-primary-600 to-primary-500 text-white shadow-md shadow-primary-500/30 hover:shadow-primary-500/50'
                            : 'cursor-not-allowed border border-slate-800 bg-slate-800 text-slate-500'
                        )}
                      >
                        <PenTool className="h-3.5 w-3.5" />
                        {hasSignature ? 'Signed' : 'Sign'}
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
