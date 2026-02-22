import { api } from './api'

export interface SectionCompletionEmailParams {
  sectionId: string
  sectionTitle: string
  day: number
  week: number
  userId: string
  userName: string
  room?: string
  roomKey?: string
}

export interface DayCompletionEmailParams {
  day: number
  week: number
  userId: string
  userName: string
  signature: string
  observations?: string
  room?: string
  roomKey?: string
}

export const emailService = {
  async sendSectionCompletionEmail(params: SectionCompletionEmailParams): Promise<void> {
    console.log('[emailService] 📧 ENVIANDO section completion email:', {
      sectionId: params.sectionId,
      sectionTitle: params.sectionTitle,
      day: params.day,
      week: params.week,
      userId: params.userId,
      userName: params.userName,
      room: params.room,
      roomKey: params.roomKey,
      timestamp: new Date().toISOString()
    })
    try {
      console.log('[emailService] 📡 Llamando a API: POST /api/emails/section-completion')
      const token = localStorage.getItem('brightworks_token')
      console.log('[emailService] 🔑 Token presente:', token ? `Sí (${token.substring(0, 20)}...)` : 'NO')
      
      const response = await api.post('/api/emails/section-completion', params)
      console.log('[emailService] ✅ RESPUESTA del servidor:', response)
      
      if (response && typeof response === 'object' && 'success' in response) {
        if (response.success === false) {
          console.error('[emailService] ❌ Servidor reportó error:', response)
          const errorResponse = response as { message?: string }
          throw new Error(errorResponse.message || 'Email no enviado por el servidor')
        }
      }
    } catch (error) {
      console.error('[emailService] ❌ ERROR COMPLETO:', error)
      if (error instanceof Error) {
        console.error('[emailService] ❌ Mensaje de error:', error.message)
        console.error('[emailService] ❌ Stack:', error.stack)
      }
      throw error
    }
  },

  async sendDayCompletionEmail(params: DayCompletionEmailParams): Promise<void> {
    console.log('[emailService] 📧 ENVIANDO day completion email:', {
      day: params.day,
      week: params.week,
      userId: params.userId,
      userName: params.userName,
      room: params.room,
      roomKey: params.roomKey,
      timestamp: new Date().toISOString()
    })
    try {
      console.log('[emailService] 📡 Llamando a API: POST /api/emails/day-completion')
      const token = localStorage.getItem('brightworks_token')
      console.log('[emailService] 🔑 Token presente:', token ? `Sí (${token.substring(0, 20)}...)` : 'NO')
      
      const response = await api.post('/api/emails/day-completion', params)
      console.log('[emailService] ✅ RESPUESTA del servidor:', response)
      
      if (response && typeof response === 'object' && 'success' in response) {
        if (response.success === false) {
          console.error('[emailService] ❌ Servidor reportó error:', response)
          const errorResponse = response as { message?: string }
          throw new Error(errorResponse.message || 'Email no enviado por el servidor')
        }
      }
    } catch (error) {
      console.error('[emailService] ❌ ERROR COMPLETO:', error)
      if (error instanceof Error) {
        console.error('[emailService] ❌ Mensaje de error:', error.message)
        console.error('[emailService] ❌ Stack:', error.stack)
      }
      throw error
    }
  },

  async sendAppAccessEmail(userId: string): Promise<void> {
    await api.post('/api/send-app-access-email', { userId })
  },
}
