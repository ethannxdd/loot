import { toast } from 'sonner'

/**
 * Everything the installed-app (PWA) experience needs that isn't React UI:
 * - registers the service worker and shows a "new version" toast when a deploy lands,
 * - remembers the browser's install prompt so Settings can offer "Install Loot",
 * - tells people when they've gone offline (the shell still opens; data waits for a connection).
 *
 * The service worker itself is generated at build time by vite-plugin-pwa (see vite.config.ts).
 */

/** Chromium's install prompt event (not in the DOM typings). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** True inside the Capacitor iOS/Android shell, where the native app replaces the PWA. */
export function isNativeShell(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return Boolean(cap?.isNativePlatform?.())
}

/** True when Loot is running as an installed app (home-screen icon), not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}

/** iPhone / iPad (iPadOS reports itself as a Mac, so check for touch too). */
export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

// ---------------------------------------------------------------------------------------------
// Install prompt — captured at startup because Chromium can fire it before React has mounted.
// ---------------------------------------------------------------------------------------------

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getInstallState(): { canPrompt: boolean; installed: boolean } {
  return { canPrompt: deferredPrompt !== null, installed: installed || isStandalone() }
}

/** Shows the browser's own install dialog. Resolves true if the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt
  if (!event) return false
  deferredPrompt = null
  await event.prompt()
  const { outcome } = await event.userChoice
  notify()
  return outcome === 'accepted'
}

// ---------------------------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------------------------

const UPDATE_CHECK_MS = 60 * 60 * 1000 // hourly while open
const OFFLINE_TOAST = 'loot-offline'

function watchConnection() {
  const showOffline = () =>
    toast('You’re offline', {
      id: OFFLINE_TOAST,
      description: 'Loot still opens, but your numbers won’t update until you’re back online.',
      duration: Infinity,
    })
  window.addEventListener('offline', showOffline)
  window.addEventListener('online', () => {
    toast.dismiss(OFFLINE_TOAST)
    toast.success('Back online', { duration: 2500 })
  })
  // Give the Toaster a moment to mount before the first toast.
  if (!navigator.onLine) window.setTimeout(showOffline, 400)
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // In dev the virtual module is a no-op (devOptions.enabled = false), so this is production-only.
  const { registerSW } = await import('virtual:pwa-register')

  const updateSW = registerSW({
    onNeedRefresh() {
      toast('A new version of Loot is ready', {
        id: 'loot-update',
        description: 'Refresh to get the latest.',
        duration: Infinity,
        action: { label: 'Refresh', onClick: () => void updateSW(true) },
      })
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Installed apps can stay open for days, so look for a new deploy hourly and whenever Loot
      // comes back to the foreground.
      const check = () => {
        if (navigator.onLine && registration.installing == null) void registration.update()
      }
      window.setInterval(check, UPDATE_CHECK_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}

let started = false

/** Called once from main.tsx after the app renders. */
export function startPwa() {
  if (started || typeof window === 'undefined') return
  started = true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // keep Chrome's mini-infobar quiet; Settings offers the install instead
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    notify()
  })

  watchConnection()

  // The Capacitor shell ships its own bundle, so it never needs a service worker.
  if (!isNativeShell()) void registerServiceWorker()
}
