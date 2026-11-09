import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { refreshCurrentSnapshot } from '@/hooks/useExpenses'
import { useFeatureFlags } from '@/hooks/useFeatures'

/**
 * Headless. Snapshots are otherwise only written when income/expenses change, so a month in which the
 * user changed nothing would have no snapshot at all — leaving holes in Stats history, the forecast and
 * the Loot Score. Once per session this makes sure the current month has an up-to-date snapshot
 * (a locked one is left alone).
 */
export function SnapshotKeeper() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const syncedFor = useRef<string | null>(null)
  // Wait for the flags (success or failure): with payday cycles on, the "current" snapshot is the cycle's.
  const { isFetched: flagsSettled } = useFeatureFlags()

  useEffect(() => {
    if (!user || !flagsSettled || syncedFor.current === user.id) return
    syncedFor.current = user.id
    refreshCurrentSnapshot(queryClient, user.id).catch((err) => {
      syncedFor.current = null
      console.warn('Initial snapshot sync failed', err)
    })
  }, [user, queryClient, flagsSettled])

  return null
}
