import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '../types'

// ============================================================
// 🚀 SISTEMA DE AUTENTICACIÓN ULTRA RÁPIDO + PREMIUM
// ============================================================

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  isLoading: boolean
  isAuthenticated: boolean
  isLocalSession: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// ============================================================
// 🗄️ CACHE ULTRA RÁPIDO (localStorage optimizado)
// ============================================================

const STORAGE_KEYS = {
  TOKEN: 'brightworks_token',
  USER: 'brightworks_user',
  CACHE_TIME: 'brightworks_auth_cache',
} as const

const CACHE_DURATION = 30 * 60 * 1000 // 30 minutos

class FastAuthCache {
  private memoryCache: { user: User | null; token: string | null } = { user: null, token: null }

  // Guardar en memoria + localStorage
  save(token: string, user: User): void {
    this.memoryCache = { token, user }
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token)
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
      localStorage.setItem(STORAGE_KEYS.CACHE_TIME, Date.now().toString())
    } catch (e) {
      console.warn('[Auth] localStorage error:', e)
    }
  }

  // Leer - primero memoria, luego localStorage
  load(): { token: string | null; user: User | null; isValid: boolean } {
    // 1. Memoria (instantáneo)
    if (this.memoryCache.token && this.memoryCache.user) {
      return { ...this.memoryCache, isValid: true }
    }

    // 2. localStorage
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
      const userStr = localStorage.getItem(STORAGE_KEYS.USER)
      const cacheTime = localStorage.getItem(STORAGE_KEYS.CACHE_TIME)

      if (!token || !userStr) {
        return { token: null, user: null, isValid: false }
      }

      // Verificar si es token real (JWT empieza con 'eyJ')
      const isRealToken = token.startsWith('eyJ')
      
      // Verificar expiración del cache
      const isExpired = cacheTime 
        ? (Date.now() - parseInt(cacheTime)) > CACHE_DURATION 
        : true

      const user = JSON.parse(userStr) as User
      this.memoryCache = { token, user }

      return { token, user, isValid: isRealToken && !isExpired }
    } catch (e) {
      return { token: null, user: null, isValid: false }
    }
  }

  clear(): void {
    this.memoryCache = { user: null, token: null }
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN)
      localStorage.removeItem(STORAGE_KEYS.USER)
      localStorage.removeItem(STORAGE_KEYS.CACHE_TIME)
      localStorage.removeItem('brightworks_selected_room')
    } catch (e) {
      console.warn('[Auth] Clear error:', e)
    }
  }
}

const authCache = new FastAuthCache()

// ============================================================
// 🔐 API DE AUTENTICACIÓN OPTIMIZADA
// ============================================================

const API_URL = ((import.meta.env.VITE_API_URL as string) || 'https://appcleanpremium-backend.onrender.com').replace(/\/$/, '')

// Normalizar usuario para compatibilidad
function normalizeUser(userData: any): User {
  return {
    _id: userData._id || userData.id || '',
    username: userData.username || '',
    email: userData.email || '',
    fullName: userData.fullName || userData.username || '',
    role: userData.role || 'employee',
    permissions: userData.permissions || [],
    createdAt: userData.createdAt || new Date().toISOString(),
    updatedAt: userData.updatedAt,
    lastLoginAt: userData.lastLoginAt,
  }
}

async function loginAPI(username: string, password: string): Promise<{ 
  success: boolean
  token?: string
  user?: User
  error?: string 
}> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.message || data.error || 'Credenciales inválidas' }
    }

    // Normalizar usuario
    const user = normalizeUser(data.user)

    return { success: true, token: data.token, user }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout - servidor no responde' }
    }
    return { success: false, error: error.message || 'Error de conexión' }
  }
}

async function verifyTokenAPI(token: string): Promise<User | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const response = await fetch(`${API_URL}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) return null

    const data = await response.json()
    return normalizeUser(data.user || data)
  } catch {
    return null
  }
}

// ============================================================
// 🎯 PROVIDER PRINCIPAL
// ============================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const isInitialized = useRef(false)
  const refreshInProgress = useRef(false)

  // 🚀 Inicialización ULTRA RÁPIDA
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    const init = async () => {
      const cached = authCache.load()
      
      // 1. Si hay cache válido, mostrar inmediatamente
      if (cached.token && cached.user && cached.isValid) {
        setToken(cached.token)
        setUser(cached.user)
        setLoading(false)

        // 2. Verificar en background (sin bloquear UI)
        verifyTokenAPI(cached.token).then((freshUser) => {
          if (freshUser) {
            const normalized = normalizeUser(freshUser)
            setUser(normalized)
            authCache.save(cached.token!, normalized)
          } else {
            // Token expirado - limpiar
            authCache.clear()
            setToken(null)
            setUser(null)
          }
        })
        return
      }

      // 3. Si hay cache pero no válido, intentar verificar
      if (cached.token && cached.user) {
        setToken(cached.token)
        setUser(cached.user)
        setLoading(false)

        const freshUser = await verifyTokenAPI(cached.token)
        if (!freshUser) {
          authCache.clear()
          setToken(null)
          setUser(null)
        } else {
          const normalized = normalizeUser(freshUser)
          setUser(normalized)
          authCache.save(cached.token, normalized)
        }
        return
      }

      // 4. No hay cache
      setLoading(false)
    }

    init()
  }, [])

  // 🔐 LOGIN
  const login = useCallback(async (username: string, password: string) => {
    if (!username || !username.trim()) {
      throw new Error('Username is required')
    }
    if (!password || !password.trim()) {
      throw new Error('Password is required')
    }

    console.log('[Auth] Attempting login for:', username)
    
    const result = await loginAPI(username.trim(), password)

    if (result.success && result.token && result.user) {
      const normalized = normalizeUser(result.user)
      setToken(result.token)
      setUser(normalized)
      authCache.save(result.token, normalized)
      console.log('[Auth] Login successful')
      return
    }

    console.log('[Auth] Login failed:', result.error)
    throw new Error(result.error || 'Login failed. Please check your credentials.')
  }, [])

  // 🚪 LOGOUT
  const logout = useCallback(() => {
    console.log('[Auth] Logging out')
    setToken(null)
    setUser(null)
    authCache.clear()
  }, [])

  // 🔄 REFRESH
  const refreshUser = useCallback(async () => {
    if (!token || refreshInProgress.current) return
    
    refreshInProgress.current = true
    const freshUser = await verifyTokenAPI(token)
    
    if (freshUser) {
      const normalized = normalizeUser(freshUser)
      setUser(normalized)
      authCache.save(token, normalized)
    }
    
    refreshInProgress.current = false
  }, [token])

  // Verificar si es sesión local (tokens que no son JWT reales)
  const isLocalSession = token ? !token.startsWith('eyJ') : false

  const value: AuthContextType = {
    user,
    token,
    loading,
    isLoading: loading,
    isAuthenticated: !!user && !!token,
    isLocalSession,
    login,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ============================================================
// 🪝 HOOK
// ============================================================

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    console.warn('useAuth called outside AuthProvider, returning default context')
    return {
      user: null,
      token: null,
      loading: false,
      isLoading: false,
      isAuthenticated: false,
      isLocalSession: false,
      login: async () => {},
      logout: () => {},
      refreshUser: async () => {},
    }
  }
  return context
}

// ============================================================
// 🔧 UTILIDAD: Obtener token para API calls
// ============================================================

export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN)
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}
