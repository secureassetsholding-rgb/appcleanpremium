import { api } from './api'
import { Task, TimeRecord } from '../types'

export interface UpdateTaskParams {
  week: number
  day: number
  taskName: string
  completed: boolean
  room?: string
  roomKey?: string
}

const STORAGE_KEY = 'brightworks_local_tasks'

// Helper functions for localStorage
const getLocalTasks = (week: number, room?: string): Task[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const allTasks = JSON.parse(stored) as Task[]
    let filtered = allTasks.filter(task => task.week === week)
    if (room) {
      // Filter by both room label and roomKey for better compatibility
      const normalizedRoom = room.toLowerCase().trim()
      filtered = filtered.filter(task => {
        const taskRoom = (task.room || '').toLowerCase().trim()
        const taskRoomKey = (task.roomKey || '').toLowerCase().trim()
        return taskRoom === normalizedRoom || taskRoomKey === normalizedRoom
      })
    }
    return filtered
  } catch {
    return []
  }
}

const saveLocalTask = (task: Task): void => {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const allTasks = stored ? (JSON.parse(stored) as Task[]) : []
    const index = allTasks.findIndex(
      t => t.week === task.week && t.day === task.day && t.taskName === task.taskName && (t.room === task.room || t.roomKey === task.roomKey)
    )
    if (index >= 0) {
      allTasks[index] = task
    } else {
      allTasks.push(task)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks))
  } catch (error) {
    console.error('Error saving task to localStorage:', error)
  }
}

export const tasksService = {
  async getTasks(week: number, room?: string, roomKey?: string): Promise<Task[]> {
    try {
      const params = new URLSearchParams({ week: week.toString() })
      // Only add room/roomKey filters if provided (when room is undefined, backend returns all tasks)
      if (room && room.trim() !== '') {
        params.set('room', room)
        // Prefer roomKey if provided (more accurate)
        if (roomKey) {
          params.set('roomKey', roomKey)
        } else {
          // Generate roomKey from room if not provided
          const generatedKey = room.toLowerCase().trim().replace(/\s+/g, '-')
          params.set('roomKey', generatedKey)
        }
      }
      
      const tasks = await api.get<Task[]>(`/api/tasks?${params.toString()}`)
      
      // Save to localStorage as backup - VERIFIED: Tasks are saved with roomKey
      if (Array.isArray(tasks)) {
        tasks.forEach(task => {
          // Ensure roomKey is set if not present
          if (!task.roomKey) {
            if (task.room) {
              task.roomKey = task.room.toLowerCase().trim().replace(/\s+/g, '-')
            } else if (roomKey) {
              task.roomKey = roomKey
            } else if (room) {
              task.roomKey = room.toLowerCase().trim().replace(/\s+/g, '-')
            }
          }
          // Ensure room is set
          if (!task.room && room) {
            task.room = room
          }
          saveLocalTask(task)
        })
      }
      return Array.isArray(tasks) ? tasks : []
    } catch (error) {
      // Fallback to localStorage if API fails
      console.log('API unavailable, using localStorage for tasks')
      return getLocalTasks(week, room)
    }
  },

  async updateTask(params: UpdateTaskParams): Promise<Task> {
    try {
      // Ensure roomKey is set if not provided
      const normalizedParams = {
        ...params,
        roomKey: params.roomKey || (params.room ? params.room.toLowerCase().trim().replace(/\s+/g, '-') : undefined)
      }
      const response = await api.put<{ message?: string; task?: Task }>('/api/tasks', normalizedParams)
      // El backend devuelve { message, task }, extraer el task
      const task = (response as any).task || response as Task
      // VERIFIED: Task is saved to localStorage with roomKey
      // Ensure roomKey is set on the returned task
      if (!task.roomKey && task.room) {
        task.roomKey = task.room.toLowerCase().trim().replace(/\s+/g, '-')
      }
      saveLocalTask(task)
      return task
    } catch (error) {
      // Fallback to localStorage if API fails
      console.log('API unavailable, saving task to localStorage')
      const roomKey = params.roomKey || (params.room ? params.room.toLowerCase().trim().replace(/\s+/g, '-') : undefined)
      const localTasks = getLocalTasks(params.week, params.room)
      const existingTask = localTasks.find(
        t => t.day === params.day && t.taskName === params.taskName && 
             (t.room === params.room || t.roomKey === roomKey || t.roomKey === params.roomKey)
      )
      
      const updatedTask: Task = existingTask
        ? { ...existingTask, completed: params.completed, roomKey: roomKey || existingTask.roomKey, updatedAt: new Date().toISOString() }
        : {
            _id: `local_${Date.now()}`,
            week: params.week,
            day: params.day,
            taskName: params.taskName,
            completed: params.completed,
            room: params.room,
            roomKey: roomKey,
            userId: 'local_user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
      
      saveLocalTask(updatedTask)
      return updatedTask
    }
  },

  async getTimeRecords(week: number, room?: string, roomKey?: string): Promise<TimeRecord[]> {
    try {
      const params = new URLSearchParams({ week: week.toString() })
      if (room) {
        params.set('room', room)
      }
      if (roomKey) {
        params.set('roomKey', roomKey)
      } else if (room) {
        params.set('roomKey', room.toLowerCase().trim().replace(/\s+/g, '-'))
      }
      return await api.get<TimeRecord[]>(`/api/time-records?${params.toString()}`)
    } catch {
      return []
    }
  },

  async updateTimeRecord(
    week: number,
    day: number,
    data: { checkIn?: string; checkOut?: string; signature?: string; room?: string; roomKey?: string; employeeName?: string; observations?: string }
  ): Promise<TimeRecord> {
    return api.put<TimeRecord>('/api/time-records', { week, day, ...data })
  },
}
