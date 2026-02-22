interface PushSubscriptionRecord {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null
  private subscription: PushSubscriptionRecord | null = null

  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported in this browser')
      return false
    }

    try {
      this.registration = await navigator.serviceWorker.ready

      if (this.registration) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
            console.log('Push notification received:', event.data)
          }
        })

        const existingSubscription = await this.registration.pushManager.getSubscription()
        if (existingSubscription) {
          this.subscription = {
            endpoint: existingSubscription.endpoint,
            keys: {
              p256dh: this.arrayBufferToBase64(existingSubscription.getKey('p256dh')!),
              auth: this.arrayBufferToBase64(existingSubscription.getKey('auth')!),
            },
          }
        }
      }

      return true
    } catch (error) {
      console.error('Error initializing push notifications:', error)
      return false
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications')
    }
    return Notification.requestPermission()
  }

  async subscribe(): Promise<PushSubscriptionRecord | null> {
    if (!this.registration) {
      await this.initialize()
    }

    if (!this.registration) {
      throw new Error('Service worker not available')
    }

    try {
      const permission = await this.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      const keyArray = this.urlBase64ToUint8Array(
        'BEl62iUYgUivxIkv69yViEuiBIa40HI2F_AODk9nfeA7XK-p9kgj38fUW4NPBq3k5ZjhZSAhU6a_7CH5CJM8XdE'
      )
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray as BufferSource,
      })

      this.subscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
        },
      }

      localStorage.setItem('brightworks_push_subscription', JSON.stringify(this.subscription))

      return this.subscription
    } catch (error) {
      console.error('Error subscribing to push notifications:', error)
      throw error
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.registration) {
      return false
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        this.subscription = null
        localStorage.removeItem('brightworks_push_subscription')
        return true
      }
      return false
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error)
      return false
    }
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      await this.initialize()
    }

    if (!this.registration) {
      return false
    }

    const subscription = await this.registration.pushManager.getSubscription()
    return subscription !== null
  }

  async getPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied'
    }
    return Notification.permission
  }

  showLocalNotification(title: string, options?: NotificationOptions): void {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'brightworks-notification',
        requireInteraction: false,
        ...options,
      })
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }
}

export const pushNotificationService = new PushNotificationService()

if (typeof window !== 'undefined') {
  pushNotificationService.initialize().catch(console.error)
}
