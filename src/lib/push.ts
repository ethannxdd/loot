import { isIOS, isNativeShell, isStandalone } from './pwa'

/**
 * Web Push on this device (Phase 6 B2, D12). Push works in desktop/Android browsers and in the installed iPhone app
 * (iOS 16.4+), but not in a normal iPhone Safari tab — there we explain "Install Loot first".
 */

export type PushSupport = 'supported' | 'ios-needs-install' | 'unsupported' | 'not-configured'

export const VAPID_PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined' || isNativeShell()) return 'unsupported'
  if (isIOS() && !isStandalone()) return 'ios-needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'not-configured'
  return 'supported'
}

/** Platform label stored with the subscription (counts only; for Analytics). */
export function pushPlatform(): 'browser' | 'pwa' | 'ios' | 'android' {
  if (isIOS()) return 'ios'
  if (/Android/i.test(navigator.userAgent)) return 'android'
  return isStandalone() ? 'pwa' : 'browser'
}

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

/** This device's current subscription, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/**
 * Asks for permission (must be called from a tap) and subscribes. Returns the subscription JSON to save, or throws a
 * friendly message.
 */
export async function subscribePush(): Promise<{ endpoint: string; p256dh: string; auth: string }> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Push isn’t set up on this Loot server yet.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for Loot. Allow them in your browser or phone settings, then try again.'
        : 'Loot needs your permission to send notifications.',
    )
  }
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready)
  const existing = await reg.pushManager.getSubscription()
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Your browser returned an incomplete subscription.')
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }
}

/** Unsubscribes this device. Returns the endpoint that was removed (to delete its row). */
export async function unsubscribePush(): Promise<string | null> {
  const sub = await currentSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => undefined)
  return endpoint
}
