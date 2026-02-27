// Professional API configuration
// Direct connection to backend, no proxy
function getApiUrl(): string {
  return (import.meta.env.VITE_API_URL as string).replace(/\/$/, '')
}

const API_URL = getApiUrl()

// Import getAuthToken from AuthContext
function getAuthToken(): string | null {
  return localStorage.getItem('brightworks_token')
}

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
    // Log API URL in development for debugging
    if (import.meta.env.DEV) {
      console.log('[API Client] Initialized with URL:', this.baseURL)
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const token = getAuthToken()
    // Solo usar tokens JWT reales (empiezan con 'eyJ') o tokens válidos
    if (token) {
      // Validar que sea un token real (JWT) o permitir tokens locales temporalmente
      // Los tokens JWT reales empiezan con 'eyJ'
      if (token.startsWith('eyJ') || token.startsWith('local_')) {
        headers.Authorization = `Bearer ${token}`
      } else {
        // Token falso del backend antiguo - no enviarlo
        console.warn('[API Client] Token inválido detectado, no se enviará en headers')
      }
    }

    return headers
  }

  private async requestWithRetry<T>(endpoint: string, options: RequestInit = {}, retries = 1): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    // Timeout más largo para login (60s) porque el servidor puede estar dormido
    const isLoginEndpoint = endpoint.includes('/login') || endpoint.includes('/auth')
    const timeoutMs = isLoginEndpoint ? 60000 : 15000
    
    const controller = new AbortController()
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      signal: controller.signal,
    }

    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, config)

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('brightworks_token')
        localStorage.removeItem('brightworks_user')
        if (!window.location.pathname.includes('/login')) {
          window.location.replace('/login')
        }
        throw new Error('Session expired')
      }

      if (!response.ok) {
        // Handle 503/504 Service Unavailable/Gateway Timeout
        if (response.status === 503 || response.status === 504) {
          // Si es login y tenemos retries, intentar de nuevo
          if (isLoginEndpoint && retries > 0) {
            console.log(`[API Client] Server sleeping, retrying in 2s... (${retries} retries left)`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            return this.requestWithRetry(endpoint, options, retries - 1)
          }
          
          const errorBody = await response
            .json()
            .then((body) => body?.message ?? body?.error ?? null)
            .catch(() => null)
          
          if (errorBody) {
            throw new Error(errorBody)
          }
          
          throw new Error(`Backend unavailable (${response.status}). The server may be starting up.`)
        }
        
        // Handle 404 specifically
        if (response.status === 404) {
          const errorBody = await response
            .json()
            .then((body) => body?.message ?? `Request failed with status 404`)
            .catch(() => `Request failed with status 404`)
          throw new Error(errorBody)
        }
        
        const fallbackMessage = `Request failed with status ${response.status}`
        const errorBody = await response
          .json()
          .then((body) => body?.message ?? fallbackMessage)
          .catch(() => fallbackMessage)
        throw new Error(errorBody)
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        return response.json() as Promise<T>
      }

      // When the backend responds with a PDF/blob or plain text, return as text
      const textPayload = await response.text()
      return textPayload as unknown as T
    } catch (error) {
      // Handle timeout errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Si es login y tenemos retries, intentar de nuevo
        if (isLoginEndpoint && retries > 0) {
          console.log(`[API Client] Timeout, retrying login... (${retries} retries left)`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          return this.requestWithRetry(endpoint, options, retries - 1)
        }
        throw new Error('Request timeout: The server did not respond in time. The server may be starting up - please wait a moment and try again.')
      }
      
      // Check for network errors (fetch failures, connection refused, etc.)
      const isNetworkError = 
        error instanceof TypeError &&
        (error.message === 'Failed to fetch' ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError when attempting to fetch resource'))
      
      if (isNetworkError) {
        // Si es login y tenemos retries, intentar de nuevo
        if (isLoginEndpoint && retries > 0) {
          console.log(`[API Client] Network error, retrying login... (${retries} retries left)`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          return this.requestWithRetry(endpoint, options, retries - 1)
        }
        
        console.error(`[API Client] Network error connecting to ${this.baseURL}`, error)
        throw new Error(`Network error: Could not connect to backend at ${this.baseURL}`)
      }
      
      // For all other errors, preserve original behavior
      if (error instanceof Error) {
        // Don't log expected errors
        if (
          !error.message.includes('Session expired') &&
          !error.message.includes('Request timeout') &&
          !error.message.includes('Network error') &&
          !error.message.includes('Backend no disponible') &&
          !error.message.includes('API no disponible') &&
          !error.message.includes('404')
        ) {
          console.error('[API Client] Request failed:', error)
        }
        throw error
      }
      throw new Error('Unexpected error')
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Para login, usar retry automático
    const isLoginEndpoint = endpoint.includes('/login') || endpoint.includes('/auth')
    const retries = isLoginEndpoint ? 2 : 0 // 2 retries para login
    
    return this.requestWithRetry(endpoint, options, retries)
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiClient(API_URL)
export const apiClient = api
