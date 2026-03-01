import { useEffect, useMemo, useState } from 'react'
import { Task, TaskSection, TimeRecord, WORK_DAYS } from '../types'
import { Download, CheckCircle2, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { generateDailyReportPDF } from '../lib/dailyReportPDF'
import { useQuery } from '@tanstack/react-query'
import { configService } from '../services/config'
import {
  CHECKBOX_STYLE_PRESETS,
  TASK_BACKGROUND_PRESETS,
  CheckboxStyleId,
  TaskBackgroundId,
} from '../constants/appearance'
import { AIAssistant } from './AIAssistant'

interface TaskTableProps {
  section: TaskSection
  week: number
  tasks: Task[]
  onTaskToggle: (taskName: string, day: number, completed: boolean) => void
  timeRecords?: TimeRecord[]
  activeRoomLabel?: string
  activeRoomKey?: string
}

export function TaskTable({
  section,
  week,
  tasks,
  onTaskToggle,
  timeRecords = [],
  activeRoomLabel,
  activeRoomKey,
}: TaskTableProps) {
  const { user } = useAuth()
  
  // Get all sections from config for PDF generation
  const { data: config } = useQuery({
    queryKey: ['taskConfig'],
    queryFn: () => configService.getConfig(),
    staleTime: Infinity,
  })
  
  const allSections = useMemo(() => {
    if (!config || !config.sections || !Array.isArray(config.sections)) return [section]
    return config.sections.filter((s): s is TaskSection => Boolean(s && s.tasks && Array.isArray(s.tasks)))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [config, section])
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const storageKey = useMemo(
    () => `brightworks_section_room_${activeRoomKey ?? 'general'}_${week}_${section.id}`,
    [activeRoomKey, week, section.id]
  )
  const [roomNote, setRoomNote] = useState(() =>
    typeof window === 'undefined' ? activeRoomLabel || '' : localStorage.getItem(storageKey) || activeRoomLabel || ''
  )
  const employeeName = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(`brightworks_employee_name_week_${week}`) || user?.fullName || user?.username || ''
  }, [week, user])
  const [taskBackground, setTaskBackground] = useState<TaskBackgroundId>(() => {
    if (typeof window === 'undefined') return 'midnight'
    return (localStorage.getItem('brightworks_task_background') as TaskBackgroundId) || 'midnight'
  })
  const [checkboxStyle, setCheckboxStyle] = useState<CheckboxStyleId>(() => {
    if (typeof window === 'undefined') return 'classic'
    return (localStorage.getItem('brightworks_checkbox_style') as CheckboxStyleId) || 'classic'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(storageKey)
    setRoomNote(stored || activeRoomLabel || '')
  }, [storageKey, activeRoomLabel])

  useEffect(() => {
    const handleBackgroundChange = (event: Event) => {
      const detail = (event as CustomEvent<TaskBackgroundId>).detail
      if (detail) {
        setTaskBackground(detail)
      } else if (typeof window !== 'undefined') {
        setTaskBackground((localStorage.getItem('brightworks_task_background') as TaskBackgroundId) || 'midnight')
      }
    }

    const handleCheckboxChange = (event: Event) => {
      const detail = (event as CustomEvent<CheckboxStyleId>).detail
      if (detail) {
        setCheckboxStyle(detail)
      } else if (typeof window !== 'undefined') {
        setCheckboxStyle((localStorage.getItem('brightworks_checkbox_style') as CheckboxStyleId) || 'classic')
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'brightworks_task_background') {
        setTaskBackground((event.newValue as TaskBackgroundId) || 'midnight')
      }
      if (event.key === 'brightworks_checkbox_style') {
        setCheckboxStyle((event.newValue as CheckboxStyleId) || 'classic')
      }
    }

    window.addEventListener('brightworks-task-bg-change', handleBackgroundChange as EventListener)
    window.addEventListener('brightworks-checkbox-style-change', handleCheckboxChange as EventListener)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('brightworks-task-bg-change', handleBackgroundChange as EventListener)
      window.removeEventListener('brightworks-checkbox-style-change', handleCheckboxChange as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const handleRoomNoteChange = (value: string) => {
    setRoomNote(value)
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, value)
    }
    toast.dismiss('room-note')
  }

  const timeRecordMap = useMemo(() => {
    return (timeRecords ?? []).reduce<Record<number, TimeRecord>>((acc, record) => {
      if (record?.day) {
        acc[record.day] = record
      }
      return acc
    }, {})
  }, [timeRecords])

  // Filter tasks by active room to ensure only tasks from the selected room are used
  const filteredTasks = useMemo(() => {
    if (!activeRoomKey) return tasks
    return tasks.filter((task) => {
      if (!task) return false
      const taskRoomKey = (task.roomKey || '').toLowerCase().trim() || (task.room || '').toLowerCase().trim().replace(/\s+/g, '-')
      return taskRoomKey === activeRoomKey.toLowerCase().trim()
    })
  }, [tasks, activeRoomKey])

  const tasksByName: Record<string, Record<number, Task>> = useMemo(() => {
    const result: Record<string, Record<number, Task>> = {}
    filteredTasks.forEach((task) => {
      if (task && task.taskName) {
        if (!result[task.taskName]) {
          result[task.taskName] = {}
        }
        result[task.taskName][task.day] = task
      }
    })
    return result
  }, [filteredTasks])

  const handleTaskToggle = (taskName: string, day: number, completed: boolean) => {
    onTaskToggle(taskName, day, completed)
    toast.success(
      completed ? `Task "${taskName}" marked as pending` : `Task "${taskName}" completed`,
      {
        icon: completed ? 'â³' : 'âœ…',
        duration: 1800,
        position: 'top-center',
      }
    )
  }

  const formatTime = (value?: string | null) => {
    if (!value) return null
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      const [hour = '', minute = ''] = value.split(':')
      return `${hour.padStart(2, '0')}:${minute}`
    }
    return null
  }

  const formatTimeForReport = (value?: string | null) => {
    const formatted = formatTime(value)
    return formatted ?? '--'
  }

  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (char) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }
      return map[char] ?? char
    })

  // Removed - PDF functionality removed (keeping for reference)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _buildSectionReportHtml = () => {
    const generatedAt = new Date().toLocaleString()
    const headerCells = WORK_DAYS.map((day) => `<th>${day.fullName}</th>`).join('')
    const taskRows = section.tasks
      .map((taskName) => {
        const statusCells = WORK_DAYS.map((day) => {
          const task = tasksByName[taskName]?.[day.num]
          const isCompleted = Boolean(task?.completed)
          return `<td class="${isCompleted ? 'status-complete' : 'status-pending'}">${
            isCompleted ? 'âœ“ Completed' : 'Pending'
          }</td>`
        }).join('')
        return `<tr><td class="task-name">${escapeHtml(taskName)}</td>${statusCells}</tr>`
      })
      .join('')

    const timeCells = WORK_DAYS.map((day) => {
      const record = timeRecordMap[day.num]
      return `<td class="time-cell">
          <div><span class="time-label">IN:</span> ${escapeHtml(formatTimeForReport(record?.checkIn))}</div>
          <div><span class="time-label">OUT:</span> ${escapeHtml(formatTimeForReport(record?.checkOut))}</div>
        </td>`
    }).join('')

    const roomDisplay = roomNote ? escapeHtml(roomNote) : escapeHtml(activeRoomLabel || 'â€”')

    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(section.title)} Â· Week ${week}</title>
      <style>
        :root {
          color-scheme: dark;
        }
        body {
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          margin: 0;
          padding: 48px;
          background: radial-gradient(circle at top left, #1e293b, #020617 60%);
          color: #e2e8f0;
        }
        .card {
          max-width: 960px;
          margin: 0 auto;
          border-radius: 28px;
          border: 1px solid rgba(148, 163, 184, 0.15);
          background: linear-gradient(160deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95));
          box-shadow: 0 30px 60px rgba(15, 23, 42, 0.35);
          overflow: hidden;
        }
        header {
          padding: 32px 36px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: linear-gradient(120deg, rgba(59, 130, 246, 0.25), transparent);
        }
        header h1 {
          margin: 0;
          font-size: 28px;
          letter-spacing: 0.02em;
        }
        header p {
          margin: 4px 0 0;
          font-size: 13px;
          color: rgba(226, 232, 240, 0.72);
        }
        .meta {
          padding: 0 36px 24px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .meta-card {
          padding: 16px 18px;
          border-radius: 18px;
          border: 1px solid rgba(59, 130, 246, 0.25);
          background: rgba(30, 41, 59, 0.6);
          font-size: 12px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.8);
        }
        .meta-card strong {
          display: block;
          margin-top: 6px;
          font-size: 15px;
          letter-spacing: normal;
          text-transform: none;
          color: #f8fafc;
        }
        table {
          width: calc(100% - 72px);
          margin: 0 auto 32px;
          border-collapse: collapse;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(59, 130, 246, 0.18);
          background: rgba(15, 23, 42, 0.75);
        }
        th, td {
          padding: 14px 16px;
          text-align: center;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          white-space: normal;
          word-break: break-word;
        }
        th {
          background: rgba(30, 58, 138, 0.35);
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(226, 232, 240, 0.85);
        }
        tr:last-child td {
          border-bottom: none;
        }
        .task-name {
          text-align: left;
          font-weight: 600;
          color: #f8fafc;
          width: 18%;
          white-space: normal;
          word-break: break-word;
        }
        .status-complete {
          background: linear-gradient(145deg, rgba(16, 185, 129, 0.16), rgba(21, 128, 61, 0.12));
          color: #bbf7d0;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .status-pending {
          background: rgba(248, 113, 113, 0.08);
          color: #fecaca;
          font-weight: 500;
        }
        .time-row td {
          background: rgba(15, 23, 42, 0.85);
          font-size: 12px;
          line-height: 1.6;
        }
        .time-label {
          color: rgba(148, 163, 184, 0.75);
          margin-right: 4px;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        footer {
          padding: 0 36px 36px;
          font-size: 12px;
          color: rgba(148, 163, 184, 0.7);
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <header>
          <div>
            <h1>${escapeHtml(section.title)}</h1>
            <p>Week ${week} Â· ${section.tasks.length} tasks</p>
          </div>
          <div style="text-align:right;font-size:12px;color:rgba(148,163,184,0.75)">
            <div>Generated: ${generatedAt}</div>
          </div>
        </header>
        <div class="meta">
          <div class="meta-card">
            Week
            <strong>${week}</strong>
          </div>
          <div class="meta-card">
            Employee Name
            <strong>${escapeHtml(employeeName || 'â€”')}</strong>
          </div>
          <div class="meta-card">
            Area / Room
            <strong>${roomDisplay}</strong>
          </div>
        </div>
        <table role="grid">
          <thead>
            <tr>
              <th>Task</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${taskRows}
            <tr class="time-row">
              <td class="task-name">Check in / out</td>
              ${timeCells}
            </tr>
          </tbody>
        </table>
        <footer>
          <span>Bright Works Â· Premium Operations Report</span>
          <span>brightworks.app</span>
        </footer>
      </div>
    </body>
    </html>`
  }

  const _buildDailyReportHtml = () => {
    const generatedAt = new Date().toLocaleString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    const totalTasks = section.tasks.length
    
    // Calculate overall statistics
    const allDayStats = WORK_DAYS.map((day) => {
      const completedCount = section.tasks.filter((taskName) => tasksByName[taskName]?.[day.num]?.completed).length
      const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0
      return { day: day.fullName, completed: completedCount, total: totalTasks, percentage }
    })
    
    const totalCompleted = allDayStats.reduce((sum, stat) => sum + stat.completed, 0)
    const totalPossible = totalTasks * WORK_DAYS.length
    const overallPercentage = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0
    
    // Calculate total hours worked
    const totalHours = WORK_DAYS.reduce((sum, day) => {
      const record = timeRecordMap[day.num]
      if (record?.checkIn && record?.checkOut) {
        const checkIn = new Date(record.checkIn)
        const checkOut = new Date(record.checkOut)
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
        return sum + (isNaN(hours) ? 0 : hours)
      }
      return sum
    }, 0)

    const dayCards = WORK_DAYS.map((day) => {
      const statuses = section.tasks.map((taskName) => {
        const task = tasksByName[taskName]?.[day.num]
        const isDone = Boolean(task?.completed)
        const completedAt = task?.updatedAt ? new Date(task.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''
        return `<li class="${isDone ? 'done' : 'pending'}">
          <span>${escapeHtml(taskName)}</span>
          ${isDone && completedAt ? `<span class="task-time">${completedAt}</span>` : '<span class="task-time">â€”</span>'}
        </li>`
      }).join('')

      const completedCount = section.tasks.filter((taskName) => tasksByName[taskName]?.[day.num]?.completed).length
      const record = timeRecordMap[day.num]
      const checkInTime = formatTimeForReport(record?.checkIn)
      const checkOutTime = formatTimeForReport(record?.checkOut)
      const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0
      
      // Calculate hours worked for this day
      let dayHours = 0
      if (record?.checkIn && record?.checkOut) {
        const checkIn = new Date(record.checkIn)
        const checkOut = new Date(record.checkOut)
        dayHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
        dayHours = isNaN(dayHours) ? 0 : Math.round(dayHours * 10) / 10
      }

      return `<div class="day-card">
        <div class="day-header">
          <h3>${day.fullName}</h3>
          <div class="day-stats">
            <span class="completion-badge ${percentage === 100 ? 'complete' : percentage >= 50 ? 'partial' : 'low'}">${percentage}%</span>
            <span class="task-count">${completedCount}/${totalTasks}</span>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${percentage}%"></div>
        </div>
        <div class="day-times">
          <div class="time-entry">
            <span class="time-label">Check In:</span>
            <span class="time-value">${escapeHtml(checkInTime)}</span>
          </div>
          <div class="time-entry">
            <span class="time-label">Check Out:</span>
            <span class="time-value">${escapeHtml(checkOutTime)}</span>
          </div>
          ${dayHours > 0 ? `<div class="time-entry hours">
            <span class="time-label">Hours:</span>
            <span class="time-value">${dayHours}h</span>
          </div>` : ''}
        </div>
        <ul class="tasks">${statuses}</ul>
      </div>`
    }).join('')

    const roomDisplay = roomNote ? escapeHtml(roomNote) : escapeHtml(activeRoomLabel || '—')
    const userRole = user?.role === 'admin' ? 'Admin' : 'Employee'
    const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/brightworkslogo.png` : '/brightworkslogo.png'

    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(section.title)} · Daily Report</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          margin: 0;
          padding: 32px 24px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          color: #e2e8f0;
          line-height: 1.6;
        }
        .wrapper {
          max-width: 1200px;
          margin: 0 auto;
        }
        .logo-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid rgba(59, 130, 246, 0.3);
        }
        .logo-header img {
          width: 80px;
          height: 80px;
          border-radius: 16px;
          border: 3px solid rgba(59, 130, 246, 0.4);
          object-fit: cover;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          background: white;
          padding: 4px;
        }
        .logo-header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(135deg, #3b82f6, #60a5fa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        header {
          margin-bottom: 32px;
        }
        header h2 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
          color: #f8fafc;
        }
        header p {
          margin: 0;
          color: rgba(148, 163, 184, 0.8);
          font-size: 14px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        .stat-card {
          padding: 20px;
          border-radius: 16px;
          border: 1px solid rgba(59, 130, 246, 0.2);
          background: linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9));
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        .stat-card.highlight {
          border-color: rgba(16, 185, 129, 0.4);
          background: linear-gradient(145deg, rgba(16, 185, 129, 0.15), rgba(15, 23, 42, 0.9));
        }
        .stat-card .label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.8);
          margin-bottom: 8px;
        }
        .stat-card .value {
          display: block;
          font-size: 28px;
          font-weight: 700;
          color: #f8fafc;
        }
        .stat-card .sub-value {
          display: block;
          font-size: 12px;
          color: rgba(148, 163, 184, 0.7);
          margin-top: 4px;
        }
        .overview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        .badge {
          padding: 16px;
          border-radius: 12px;
          border: 1px solid rgba(59, 130, 246, 0.25);
          background: linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.85));
        }
        .badge span {
          display: block;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.75);
          margin-bottom: 6px;
        }
        .badge strong {
          display: block;
          font-size: 18px;
          font-weight: 600;
          color: #f8fafc;
        }
        .day-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .day-card {
          border-radius: 16px;
          border: 1px solid rgba(59, 130, 246, 0.2);
          background: linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.6));
          padding: 20px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .day-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
        }
        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .day-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #f8fafc;
        }
        .day-stats {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .completion-badge {
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          color: white;
        }
        .completion-badge.complete {
          background: linear-gradient(135deg, #10b981, #34d399);
        }
        .completion-badge.partial {
          background: linear-gradient(135deg, #f59e0b, #fbbf24);
        }
        .completion-badge.low {
          background: linear-gradient(135deg, #ef4444, #f87171);
        }
        .task-count {
          font-size: 12px;
          color: rgba(148, 163, 184, 0.8);
          font-weight: 500;
        }
        .progress-bar-container {
          width: 100%;
          height: 8px;
          background: rgba(30, 41, 59, 0.8);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .day-times {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(15, 23, 42, 0.5);
          border-radius: 8px;
        }
        .time-entry {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .time-entry.hours {
          margin-top: 4px;
          padding-top: 8px;
          border-top: 1px solid rgba(59, 130, 246, 0.2);
        }
        .time-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(148, 163, 184, 0.8);
          font-weight: 600;
        }
        .time-value {
          font-size: 13px;
          color: #f8fafc;
          font-weight: 600;
          font-family: 'Courier New', monospace;
        }
        .tasks {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .tasks li {
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s;
        }
        .tasks li.done {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1));
          color: #86efac;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .tasks li.pending {
          background: linear-gradient(135deg, rgba(248, 113, 113, 0.15), rgba(248, 113, 113, 0.05));
          color: #fecaca;
          border: 1px solid rgba(248, 113, 113, 0.2);
        }
        .task-time {
          font-size: 11px;
          color: rgba(148, 163, 184, 0.7);
          font-family: 'Courier New', monospace;
        }
        .summary-section {
          margin-top: 32px;
          padding: 24px;
          border-radius: 16px;
          border: 1px solid rgba(59, 130, 246, 0.2);
          background: linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9));
        }
        .summary-section h3 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
          color: #f8fafc;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        .summary-item {
          padding: 12px;
          background: rgba(15, 23, 42, 0.6);
          border-radius: 8px;
          text-align: center;
        }
        .summary-item .label {
          font-size: 11px;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.7);
          margin-bottom: 4px;
        }
        .summary-item .value {
          font-size: 20px;
          font-weight: 700;
          color: #f8fafc;
        }
        footer {
          margin-top: 40px;
          padding-top: 24px;
          border-top: 2px solid rgba(59, 130, 246, 0.2);
          font-size: 12px;
          color: rgba(148, 163, 184, 0.7);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        @media print {
          body { padding: 20px; }
          .day-card { break-inside: avoid; page-break-inside: avoid; }
          .stats-grid { break-inside: avoid; }
          .overview { break-inside: avoid; }
          .logo-header { break-inside: avoid; }
        }
        
        /* Premium enhancements */
        .day-card {
          position: relative;
        }
        .day-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6);
          border-radius: 16px 16px 0 0;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="logo-header">
          <img src="${logoUrl}" alt="Bright Works Logo" onerror="this.style.display='none'" crossorigin="anonymous" />
          <div>
            <h1>${escapeHtml(section.title)}</h1>
            <p>Daily Activity Report · Week ${week}</p>
          </div>
        </div>
        <header>
          <h2>Report Generated: ${generatedAt}</h2>
        </header>
        <div class="stats-grid">
          <div class="stat-card highlight">
            <span class="label">Overall Completion</span>
            <span class="value">${overallPercentage}%</span>
            <span class="sub-value">${totalCompleted} of ${totalPossible} tasks</span>
          </div>
          <div class="stat-card">
            <span class="label">Total Hours Worked</span>
            <span class="value">${Math.round(totalHours * 10) / 10}h</span>
            <span class="sub-value">This week</span>
          </div>
          <div class="stat-card">
            <span class="label">Employee</span>
            <span class="value">${escapeHtml(employeeName || 'â€”')}</span>
            <span class="sub-value">${escapeHtml(userRole)}</span>
          </div>
          <div class="stat-card">
            <span class="label">Area / Room</span>
            <span class="value">${roomDisplay}</span>
            <span class="sub-value">Active location</span>
          </div>
        </div>
        <div class="overview">
          <div class="badge">
            <span>Total Tasks</span>
            <strong>${totalTasks}</strong>
          </div>
          <div class="badge">
            <span>Completed</span>
            <strong>${totalCompleted}</strong>
          </div>
          <div class="badge">
            <span>Pending</span>
            <strong>${totalPossible - totalCompleted}</strong>
          </div>
          <div class="badge">
            <span>Completion Rate</span>
            <strong>${overallPercentage}%</strong>
          </div>
        </div>
        <div class="day-grid">
          ${dayCards}
        </div>
        <footer>
          <span>Bright Works Â· Daily schedule summary</span>
          <span>brightworks.app</span>
        </footer>
      </div>
    </body>
    </html>`
  }

  const _openReportWindow = (html: string, autoPrint = false) => {
    try {
      const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800')
      if (!reportWindow) {
        toast.error('Please allow pop-ups to view the report.', { id: 'daily-loading' })
        return false
      }
      
      reportWindow.document.open()
      reportWindow.document.write(html)
      reportWindow.document.close()
      reportWindow.focus()
      
      if (autoPrint) {
        setTimeout(() => {
          reportWindow.print()
        }, 500)
      }
      return true
    } catch (error) {
      console.error('Error opening report window:', error)
      toast.error('Failed to open report window.', { id: 'daily-loading' })
      return false
      }
  }

  // Kept for reference (PDF HTML flow removed)
  void ([_buildSectionReportHtml, _buildDailyReportHtml, _openReportWindow] as const)

  const handleDailyReport = async () => {
    try {
      toast.loading('Generating daily report PDFs...', { id: 'daily-loading' })
      
      if (!user) {
        toast.error('You must be logged in to generate PDFs', { id: 'daily-loading' })
        return
      }

      // Generate PDF only for days that have tasks
      // First, find which days have tasks
      const daysWithTasks = new Set(tasks.map(t => t.day))
      const daysToGenerate = WORK_DAYS.filter(day => daysWithTasks.has(day.num))
      
      console.log('[TaskTable PDF] Total tasks available:', tasks.length)
      console.log('[TaskTable PDF] Days with tasks:', Array.from(daysWithTasks))
      console.log('[TaskTable PDF] Days to generate PDFs:', daysToGenerate.map(d => d.fullName))
      
      if (daysToGenerate.length === 0) {
        toast.error('No tasks found to generate PDF', { id: 'daily-loading' })
        return
      }
      
      // Generate PDF only for days that have tasks
      const generatedCount = await Promise.all(
        daysToGenerate.map(async (day) => {
          try {
            // Filter tasks for this day
            const dayTasks = tasks.filter((task) => task.day === day.num)
            const dayTimeRecords = timeRecords.filter((r) => r.day === day.num)
            
            console.log(`[TaskTable PDF] Generating PDF for ${day.fullName}:`, {
              day: day.num,
              tasksCount: dayTasks.length,
              completedCount: dayTasks.filter(t => {
                const completed = t.completed
                if (typeof completed === 'boolean') return completed
                // TypeScript knows completed is boolean, but we handle edge cases
                return Boolean(completed)
              }).length
            })
            
            // Generate PDF for this day with ALL sections (not just the current one)
            await generateDailyReportPDF({
              day: day.num,
              week,
              tasks: dayTasks,
              timeRecords: dayTimeRecords,
              sections: allSections, // ALL sections for accurate total count
              userName: employeeName || user.fullName || user.username || 'Employee',
              userRole: user.role === 'admin' ? 'Admin' : 'Employee',
              roomLabel: activeRoomLabel || 'General',
            })
            
            return true
          } catch (error) {
            console.error(`Error generating PDF for ${day.fullName}:`, error)
            return false
          }
        })
      )

      const successCount = generatedCount.filter(Boolean).length
      
      if (successCount > 0) {
        toast.success(`Generated ${successCount} daily report PDF(s)!`, { 
          icon: '📊', 
          id: 'daily-loading', 
          duration: 3000 
        })
      } else {
        toast.error('Failed to generate PDFs', { id: 'daily-loading' })
      }
    } catch (error) {
      console.error('Daily report error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to generate report: ${errorMessage}`, { id: 'daily-loading', icon: '❌', duration: 5000 })
    }
  }

  const backgroundPreset = TASK_BACKGROUND_PRESETS[taskBackground] ?? TASK_BACKGROUND_PRESETS.midnight
  const checkboxPreset = CHECKBOX_STYLE_PRESETS[checkboxStyle] ?? CHECKBOX_STYLE_PRESETS.classic

  return (
    <div className={cn('w-full rounded-2xl overflow-hidden', backgroundPreset.container)}>
      <div
        className={cn(
          'flex flex-col gap-2 border-b px-2 py-2 sm:gap-3 sm:px-3 sm:py-3 md:gap-4 md:px-4 md:py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6',
          backgroundPreset.headerBorder,
          backgroundPreset.headerBg
        )}
      >
        <div className="flex w-full flex-1 flex-col gap-2 text-white sm:gap-2.5 sm:flex-row sm:items-center sm:justify-between md:gap-3 lg:gap-6">
          <div className="flex items-start gap-2 sm:gap-2.5 md:gap-3 sm:items-center">
            {section.icon && <span className="text-base sm:text-lg md:text-xl lg:text-2xl drop-shadow-lg">{section.icon}</span>}
            <div>
              <h2 className="text-sm font-semibold tracking-wide sm:text-base md:text-lg lg:text-xl">{section.title}</h2>
              <p className="text-[10px] text-primary-100/80 sm:text-xs">Week {week} Â· {section.tasks.length} tasks</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-1 sm:max-w-xs">
            <label className="text-[9px] font-semibold uppercase tracking-wide text-primary-100/80 sm:text-[10px] md:text-[11px]">Area / Room</label>
            <input
              value={roomNote}
              onChange={(event) => handleRoomNoteChange(event.target.value)}
              placeholder="Example: Level 2 Â· Executive Lobby"
              className="w-full rounded-lg border border-white/20 bg-white/15 px-2 py-1.5 text-[10px] text-white placeholder:text-primary-100/50 shadow-inner shadow-primary-900/20 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/40 sm:rounded-xl sm:px-2.5 sm:py-2 sm:text-xs md:text-sm"
            />
          </div>
        </div>
        <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:gap-1.5">
          <button
            type="button"
            onClick={handleDailyReport}
            className="group flex-1 rounded-lg border border-sky-200/50 bg-gradient-to-r from-sky-300 via-sky-400 to-sky-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-900 shadow-md shadow-sky-500/30 transition hover:shadow-sky-400/50 sm:flex-none sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[11px] md:px-4 md:py-2 md:text-xs"
          >
            <span className="flex items-center justify-center gap-1 sm:gap-1.5">
              <Download className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 sm:h-3.5 sm:w-3.5" />
              Daily report
            </span>
          </button>
        </div>
      </div>

      {/* TABLA CON SCROLL HORIZONTAL MEJORADO */}
      <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-full inline-block align-middle">
          
          {/* HEADER DE LA TABLA */}
          <div className={cn(
            'grid border-b bg-slate-900/80 w-full',
            'grid-cols-[minmax(90px,0.6fr)_repeat(5,minmax(65px,1fr))]',
            'sm:grid-cols-[minmax(130px,0.8fr)_repeat(5,minmax(85px,1fr))]',
            'md:grid-cols-[minmax(150px,0.9fr)_repeat(5,minmax(100px,1fr))]',
            'lg:grid-cols-[minmax(180px,1fr)_repeat(5,minmax(120px,1fr))]',
            'xl:grid-cols-[minmax(200px,1fr)_repeat(5,minmax(140px,1fr))]',
            '2xl:grid-cols-[minmax(240px,1fr)_repeat(5,minmax(160px,1fr))]',
            backgroundPreset.headerBorder
          )}
          >
            <div className="px-1.5 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-300 sm:px-2 sm:text-[10px] md:px-3 md:text-xs">
              Task
            </div>
            {WORK_DAYS.map((day, index) => {
              const record = timeRecordMap[day.num]
              const checkIn = formatTime(record?.checkIn)
              const checkOut = formatTime(record?.checkOut)
              return (
                <div
                  key={day.num}
                  className={cn(
                    'px-1 py-1.5 text-[9px] text-center font-semibold uppercase tracking-wide transition-colors sm:px-1.5 sm:py-2 sm:text-[10px] md:text-xs',
                    index % 2 === 0 ? backgroundPreset.dayHeaderEven : backgroundPreset.dayHeaderOdd,
                    hoveredDay === day.num && backgroundPreset.dayHeaderHover
                  )}
                  onMouseEnter={() => setHoveredDay(day.num)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  <div className="flex w-full flex-col items-center justify-center">
                    <div className="w-full rounded-md border border-emerald-300/30 bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-50 shadow-inner shadow-emerald-500/20 sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-[10px] md:px-2 md:py-1.5 md:text-[11px]">
                      <div className="text-center text-[9px] sm:text-[10px] md:text-[11px]">{day.name}</div>
                      <div className="mt-0.5 space-y-0.5 text-[8px] font-medium normal-case text-emerald-50/90 sm:mt-1 sm:text-[9px] md:text-[10px]">
                        {checkIn || checkOut ? (
                          <>
                            {checkIn && (
                              <div className="flex items-center justify-between gap-0.5">
                                <span className="text-emerald-100/70 text-[8px] sm:text-[9px]">In</span>
                                <span className="text-[8px] sm:text-[9px] md:text-[10px]">{checkIn}</span>
                              </div>
                            )}
                            {checkOut && (
                              <div className="flex items-center justify-between gap-0.5">
                                <span className="text-emerald-100/70 text-[8px] sm:text-[9px]">Out</span>
                                <span className="text-[8px] sm:text-[9px] md:text-[10px]">{checkOut}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center rounded-md border border-emerald-400/20 bg-emerald-500/10 py-0.5 text-[7px] text-emerald-100/60 sm:rounded-lg sm:text-[8px] md:text-[9px]">
                            No time
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* FILAS DE TAREAS */}
          {section.tasks.map((taskName, rowIndex) => {
            const taskRow = tasksByName[taskName] || {}
            const taskId = `${section.id}-${taskName}-${week}`
            
            return (
              <div
                key={taskName}
                className={cn(
                  'grid border-b transition-colors duration-150 w-full',
                  'grid-cols-[minmax(90px,0.6fr)_repeat(5,minmax(65px,1fr))]',
                  'sm:grid-cols-[minmax(130px,0.8fr)_repeat(5,minmax(85px,1fr))]',
                  'md:grid-cols-[minmax(150px,0.9fr)_repeat(5,minmax(100px,1fr))]',
                  'lg:grid-cols-[minmax(180px,1fr)_repeat(5,minmax(120px,1fr))]',
                  'xl:grid-cols-[minmax(200px,1fr)_repeat(5,minmax(140px,1fr))]',
                  '2xl:grid-cols-[minmax(240px,1fr)_repeat(5,minmax(160px,1fr))]',
                  rowIndex % 2 === 0 ? backgroundPreset.rowEven : backgroundPreset.rowOdd
                )}
              >
                <div className="flex items-center justify-between gap-1 px-1.5 py-1.5 sm:gap-2 sm:px-2 sm:py-2 md:px-3">
                  <span className="text-[9px] font-medium text-white flex-1 min-w-0 leading-tight sm:text-[10px] md:text-xs">
                    {taskName}
                  </span>
                  <div className="relative flex-shrink-0">
                    <AIAssistant
                      taskName={taskName}
                      taskId={taskId}
                      onComplete={() => {
                        const today = new Date().getDay()
                        const dayNum = today === 0 ? 7 : today
                        const currentTask = taskRow[dayNum]
                        if (currentTask && !currentTask.completed) {
                          handleTaskToggle(taskName, dayNum, false)
                        } else if (!currentTask) {
                          handleTaskToggle(taskName, dayNum, false)
                        }
                      }}
                    />
                  </div>
                </div>
                {WORK_DAYS.map((day, columnIndex) => {
                  const task = taskRow[day.num]
                  const isCompleted = task?.completed ?? false

                  return (
                    <div
                      key={`${taskName}-${day.num}`}
                      className={cn(
                        'flex items-center justify-center px-1 py-1.5 transition-colors sm:px-1.5 sm:py-2 md:px-2',
                        columnIndex % 2 === 0 ? backgroundPreset.cellEven : backgroundPreset.cellOdd,
                        hoveredDay === day.num && backgroundPreset.cellHover
                      )}
                      onMouseEnter={() => setHoveredDay(day.num)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      <button
                        type="button"
                        onClick={() => handleTaskToggle(taskName, day.num, isCompleted)}
                        className={cn(
                          'flex h-5 w-5 items-center justify-center transition-all touch-manipulation sm:h-6 sm:w-6 md:h-7 md:w-7',
                          checkboxPreset.base,
                          isCompleted
                            ? checkboxPreset.completed
                            : hoveredDay === day.num
                            ? checkboxPreset.hover
                            : checkboxPreset.idle
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5" />
                        ) : (
                          <Circle className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5" />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
