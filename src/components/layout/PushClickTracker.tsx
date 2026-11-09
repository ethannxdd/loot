import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { reportPushClick } from '@/hooks/usePush'

/**
 * Headless: the service worker opens Loot with ?pushd=<delivery id> when a push is tapped. Record the click
 * (push_deliveries.clicked_at, for Analytics) and drop the parameter. Also follows NAVIGATE messages from the worker.
 */
export function PushClickTracker() {
  const router = useRouter()
  const href = useRouterState({ select: (s) => s.location.href })

  useEffect(() => {
    const url = new URL(href, window.location.origin)
    const id = Number(url.searchParams.get('pushd'))
    if (!id) return
    url.searchParams.delete('pushd')
    router.history.replace(`${url.pathname}${url.search}${url.hash}`)
    void reportPushClick(id).catch(() => undefined)
  }, [href, router])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'NAVIGATE' && typeof e.data.href === 'string' && e.data.href.startsWith('/')) router.history.push(e.data.href)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [router])

  return null
}
