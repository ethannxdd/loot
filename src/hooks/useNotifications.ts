import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { generateNotificationCandidates, type NotificationInputs } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/lib/types'
import { useAuth } from './useAuth'

export function notificationsQueryKey(userId: string | undefined) {
  return ['notifications', userId] as const
}

export function useNotifications() {
  const { user } = useAuth()
  return useQuery({
    queryKey: notificationsQueryKey(user?.id),
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as AppNotification[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

export function useMarkNotificationRead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey(user?.id) }),
  })
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!user) return
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey(user?.id) }),
  })
}

/**
 * Generates fresh notification candidates from live app state and inserts any that don't
 * already exist (matched by `dedupe_key`) — never overwrites an existing row, so a
 * notification the user already read stays read. Call this once, high in the tree.
 */
export function useGenerateNotifications(inputs: NotificationInputs, ready: boolean) {
  const { user } = useAuth()
  const { data: existing, isSuccess: existingLoaded } = useNotifications()
  const queryClient = useQueryClient()
  const lastRun = useRef<string | null>(null)

  useEffect(() => {
    // Wait until the existing notifications have actually loaded — generating against an empty
    // list would try to re-insert rows that already exist.
    if (!user || !ready || !existingLoaded || !existing) return
    const signature = `${user.id}|${JSON.stringify(inputs)}`
    if (lastRun.current === signature) return

    const candidates = generateNotificationCandidates(inputs)
    const existingKeys = new Set(existing.map((n) => n.dedupe_key))
    const toInsert = candidates.filter((c) => !existingKeys.has(c.dedupe_key))
    if (toInsert.length === 0) {
      lastRun.current = signature
      return
    }

    // `ignoreDuplicates` makes this idempotent even if two tabs (or a re-render) race each other:
    // a candidate that already exists is skipped, never turned into a failed batch.
    supabase
      .from('notifications')
      .upsert(
        toInsert.map((c) => ({ ...c, user_id: user.id })),
        { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
      )
      .then(({ error }) => {
        if (error) return // leave lastRun unset so the next state change retries
        lastRun.current = signature
        void queryClient.invalidateQueries({ queryKey: notificationsQueryKey(user.id) })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ready, existingLoaded, existing?.length, JSON.stringify(inputs)])
}
