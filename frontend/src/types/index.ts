export type Permission = 
  | 'schedule' 
  | 'daily_report' 
  | 'dashboard' 
  | 'calendar' 
  | 'notes' 
  | 'reminders' 
  | 'expenses' 
  | 'quotes' 
  | 'clients' 
  | 'users' 
  | 'settings'

export interface User {
  _id: string
  username: string
  email: string
  fullName?: string
  role: 'superadmin' | 'admin' | 'employee'
  permissions?: Permission[]
  createdAt: string
  updatedAt?: string
  lastLoginAt?: string
}

export const WORK_DAYS = [
  { num: 1, name: 'Mon', fullName: 'Monday' },
  { num: 2, name: 'Tue', fullName: 'Tuesday' },
  { num: 3, name: 'Wed', fullName: 'Wednesday' },
  { num: 4, name: 'Thu', fullName: 'Thursday' },
  { num: 5, name: 'Fri', fullName: 'Friday' },
] as const

export interface Task {
  _id: string
  week: number
  day: number
  taskName: string
  completed: boolean
  userId: string
  room?: string
  roomKey?: string
  createdAt: string
  updatedAt: string
}

export interface TimeRecord {
  _id: string
  week: number
  day: number
  userId: string
  checkIn?: string
  checkOut?: string
  signature?: string
  observations?: string
  room?: string
  roomKey?: string
  employeeName?: string
  createdAt: string
  updatedAt: string
}

export interface RoomSummary {
  key: string
  label: string
  createdAt: string
  updatedAt: string
}

export interface TaskConfig {
  sections: TaskSection[]
  version?: number
  lastUpdated?: string
}

export interface TaskSection {
  id: string
  title: string
  tasks: string[]
  order: number
  icon?: string
}
