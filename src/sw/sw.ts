/// <reference lib="webworker" />
/**
 * Loot's service worker (Phase 6 B2 — vite-plugin-pwa `injectManifest`).
 *
 * Caching is exactly what the generated worker did before (vite.config.ts history):
 * - pre-cache the app shell (the build injects the list into self.__WB_MANIFEST),
 * - SPA navigations fall back to /index.html,
 * - hashed /assets/ files that weren't pre-cached (pdf.js, jsPDF, html2canvas) are cached on first use,
 * - Supabase (another origin) is never matched, so data is never cached.
 * Plus Web Push: `push` shows the notification, `notificationclick` focuses/opens Loot at its link.
 * Updates stay prompt-based: the page posts SKIP_WAITING when the person taps Refresh (src/lib/pwa.ts).
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: 'loot-lazy-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 60 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting()
})

// ---------------------------------------------------------------------------------------------------------
// Web Push
// ---------------------------------------------------------------------------------------------------------

interface LootPush {
  title?: string
  body?: string
  link?: string
  /** push_deliveries.id — reported back as a click. */
  d?: number
  tag?: string
}

self.addEventListener('push', (event) => {
  let data: LootPush = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  const title = data.title || 'Loot'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      tag: data.tag,
      data: { link: data.link || '/dashboard', d: data.d },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { link, d } = (event.notification.data ?? {}) as { link?: string; d?: number }
  // Only ever open Loot's own pages.
  const path = link && link.startsWith('/') && !link.startsWith('//') ? link : '/dashboard'
  const url = new URL(path, self.location.origin)
  if (d) url.searchParams.set('pushd', String(d))
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin) as WindowClient | undefined
      if (existing) {
        await existing.focus()
        await existing.navigate(url.href).catch(() => existing.postMessage({ type: 'NAVIGATE', href: url.pathname + url.search }))
        return
      }
      await self.clients.openWindow(url.href)
    })(),
  )
})
