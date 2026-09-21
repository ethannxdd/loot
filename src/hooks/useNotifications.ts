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
  const { data: existing = [] } = useNotifications()
  const queryClient = useQueryClient()
  const lastRun = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !ready) return
    const signature = JSON.stringify(inputs)
    if (lastRun.current === signature) return
    lastRun.current = signature

    const candidates = generateNotificationCandidates(inputs)
    const existingKeys = new Set(existing.map((n) => n.dedupe_key))
    const toInsert = candidates.filter((c) => !existingKeys.has(c.dedupe_key))
    if (toInsert.length === 0) return

    supabase
      .from('notifications')
      .insert(toInsert.map((c) => ({ ...c, user_id: user.id })))
      .then(({ error }) => {
        if (!error) queryClient.invalidateQueries({ queryKey: notificationsQueryKey(user.id) })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ready, JSON.stringify(inputs), existing.length])
}
