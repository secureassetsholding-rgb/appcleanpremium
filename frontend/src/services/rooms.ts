import { RoomSummary } from '../types'
import { api } from './api'

export interface CreateRoomPayload {
  label: string
}

const STORAGE_KEY = 'brightworks_local_rooms'

// Helper functions for localStorage
const getLocalRooms = (): RoomSummary[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const rooms = JSON.parse(stored) as RoomSummary[]
    return Array.isArray(rooms) ? rooms : []
  } catch {
    return []
  }
}

const saveLocalRooms = (rooms: RoomSummary[]): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms))
  } catch (error) {
    console.error('Error saving rooms to localStorage:', error)
  }
}

const normalizeRoomKey = (label: string): string => {
  return label.trim().toLowerCase().replace(/\s+/g, '-')
}

export const roomsService = {
  async getRooms(): Promise<RoomSummary[]> {
    try {
      // Try API first
      const response = await api.get<RoomSummary[] | { value?: RoomSummary[] }>('/api/rooms')
      // Handle both array response and object with value property
      const rooms = Array.isArray(response) ? response : (response?.value || [])
      if (!Array.isArray(rooms)) {
        console.warn('Unexpected rooms response format:', response)
        throw new Error('Invalid API response')
      }
      const validRooms = rooms
        .filter((room): room is RoomSummary => Boolean(room && typeof room === 'object' && 'key' in room && 'label' in room))
        .sort((a, b) => a.label.localeCompare(b.label))
      
      // Save to localStorage as backup
      saveLocalRooms(validRooms)
      return validRooms
    } catch (error) {
      // Fallback to localStorage if API fails
      console.log('API unavailable, using localStorage for rooms')
      const localRooms = getLocalRooms()
      return localRooms.sort((a, b) => a.label.localeCompare(b.label))
    }
  },

  async createRoom(label: string): Promise<RoomSummary | null> {
    if (!label || !label.trim()) {
      return null
    }

    const trimmedLabel = label.trim()
    const roomKey = normalizeRoomKey(trimmedLabel)
    const now = new Date().toISOString()

    const newRoom: RoomSummary = {
      key: roomKey,
      label: trimmedLabel,
      createdAt: now,
      updatedAt: now,
    }

    try {
      // Try API first
      const payload: CreateRoomPayload = { label: trimmedLabel }
      const response = await api.post<RoomSummary>('/api/rooms', payload)
      if (response) {
        // Save to localStorage
        const localRooms = getLocalRooms()
        const exists = localRooms.some(r => r.key === response.key)
        if (!exists) {
          saveLocalRooms([...localRooms, response])
        }
        return response
      }
      throw new Error('API returned null')
    } catch (error) {
      // Fallback to localStorage if API fails
      console.log('API unavailable, saving room to localStorage')
      const localRooms = getLocalRooms()
      
      // Check if room already exists
      const exists = localRooms.some(r => r.key === roomKey)
      if (exists) {
        console.warn('Room already exists:', roomKey)
        return localRooms.find(r => r.key === roomKey) || null
      }

      // Add new room to localStorage
      const updatedRooms = [...localRooms, newRoom]
      saveLocalRooms(updatedRooms)
      
      return newRoom
    }
  },
}

