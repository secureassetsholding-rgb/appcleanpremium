import { api } from './api'
import type { User } from '../types'

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

// Usuarios locales de respaldo (solo cuando backend no responde)
const LOCAL_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: 'admin123',
    user: {
      _id: 'local-admin',
      username: 'admin',
      email: 'admin@brightworks.local',
      fullName: 'Administrator',
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
  },
  employee: {
    password: 'employee123',
    user: {
      _id: 'local-employee',
      username: 'employee',
      email: 'employee@brightworks.local',
      fullName: 'Employee',
      role: 'employee',
      createdAt: new Date().toISOString(),
    },
  },
}

function generateLocalToken(userId: string): string {
  return `local_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

function tryLocalAuth(credentials: LoginCredentials): LoginResponse | null {
  const localUser = LOCAL_USERS[credentials.username.toLowerCase()]
  
  if (!localUser) {
    return null
  }
  
  if (localUser.password !== credentials.password) {
    return null
  }
  
  console.log('[Auth] Using local fallback authentication')
  return {
    token: generateLocalToken(localUser.user._id),
    user: localUser.user,
  }
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const trimmedCredentials = {
      username: credentials.username.trim(),
      password: credentials.password
    }
    
    if (!trimmedCredentials.username) {
      throw new Error('Username is required')
    }
    
    if (!trimmedCredentials.password) {
      throw new Error('Password is required')
    }

    try {
      console.log('[Auth] Attempting login for:', trimmedCredentials.username)
      const response = await api.post<LoginResponse>('/api/login', trimmedCredentials)
      
      if (!response || !response.token || !response.user) {
        console.error('[Auth] Invalid response from server:', response)
        throw new Error('Invalid response from server')
      }
      
      console.log('[Auth] Login successful via backend')
      localStorage.setItem('brightworks_token', response.token)
      localStorage.setItem('brightworks_user', JSON.stringify(response.user))
      
      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log('[Auth] Backend error:', errorMessage)
      
      // Si es error de conexión/timeout/503/504, intentar auth local
      const isConnectionError = 
        errorMessage.includes('503') ||
        errorMessage.includes('504') ||
        errorMessage.includes('Backend no disponible') ||
        errorMessage.includes('unavailable') ||
        errorMessage.includes('Network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('Timeout') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ECONNREFUSED')
      
      if (isConnectionError) {
        console.log('[Auth] Backend unavailable, trying local fallback...')
        const localResponse = tryLocalAuth(trimmedCredentials)
        
        if (localResponse) {
          console.log('[Auth] Local authentication successful')
          localStorage.setItem('brightworks_token', localResponse.token)
          localStorage.setItem('brightworks_user', JSON.stringify(localResponse.user))
          return localResponse
        }
        
        // Credenciales incorrectas incluso para auth local
        throw new Error('Invalid username or password')
      }
      
      // Errores de credenciales del backend
      if (errorMessage.includes('401') || errorMessage.includes('Invalid') || errorMessage.includes('incorrect')) {
        throw new Error('Invalid username or password')
      }
      
      if (errorMessage.includes('423') || errorMessage.includes('locked')) {
        throw new Error('Account locked. Try again in 15 minutes.')
      }
      
      if (errorMessage.includes('429') || errorMessage.includes('Too many')) {
        throw new Error('Too many attempts. Please try again later.')
      }
      
      throw new Error(errorMessage || 'Login failed. Please try again.')
    }
  },

  logout(): void {
    localStorage.removeItem('brightworks_token')
    localStorage.removeItem('brightworks_user')
    localStorage.removeItem('brightworks_selected_room')
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('brightworks_user')
    if (!userStr) return null
    try {
      return JSON.parse(userStr)
    } catch {
      return null
    }
  },

  getToken(): string | null {
    return localStorage.getItem('brightworks_token')
  },

  isAuthenticated(): boolean {
    const token = this.getToken()
    const user = this.getCurrentUser()
    return !!token && !!user
  },
  
  isLocalSession(): boolean {
    const token = this.getToken()
    return token?.startsWith('local_') ?? false
  },
}
