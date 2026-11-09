import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useLogSpendSheet } from '@/context/LogSpendContext'
import { useFeature } from '@/hooks/useFeatures'

/** Headless: `?log=1` on any page opens the Log sheet, then drops the parameter so Back doesn't reopen it. */
export function LogSpendUrlOpener() {
  const live = useFeature('live_cycle')
  const { openLog } = useLogSpendSheet()
  const router = useRouter()
  const href = useRouterState({ select: (s) => s.location.href })

  useEffect(() => {
    if (!live) return
    const url = new URL(href, window.location.origin)
    if (url.searchParams.get('log') !== '1') return
    url.searchParams.delete('log')
    router.history.replace(`${url.pathname}${url.search}${url.hash}`)
    openLog()
  }, [href, live, openLog, router])

  return null
}
