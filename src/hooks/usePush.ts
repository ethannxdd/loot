import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentSubscription, pushPlatform, pushSupport, subscribePush, unsubscribePush } from '@/lib/push'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { useUpdateProfile } from './useProfile'

function deviceKey(userId: string | undefined) {
  return ['push_device', userId] as const
}

/** Whether THIS device is subscribed (and to whom the browser's permission belongs). */
export function usePushDevice() {
  const { user } = useAuth()
  return useQuery({
    queryKey: deviceKey(user?.id),
    queryFn: async () => {
      const support = pushSupport()
      const sub = support === 'supported' ? await currentSubscription() : null
      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default'
      return { support, subscribed: Boolean(sub), permission }
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  })
}

/** How many devices this account has push on, by platform (no endpoints). */
export function usePushSummary() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['push_summary', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_push_summary')
      if (error) throw error
      return (data ?? []) as { platform: string; created_at: string; last_success_at: string | null }[]
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    retry: false,
    meta: { silent: true },
  })
}

/** Switches push on/off for this device. Must be started from a tap (the permission prompt needs it). */
export function useTogglePush() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (on: boolean) => {
      if (!user) throw new Error('Not signed in')
      if (on) {
        const sub = await subscribePush()
        const { error } = await supabase.from('push_subscriptions').upsert(
          {
            user_id: user.id,
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
            platform: pushPlatform(),
            user_agent: navigator.userAgent.slice(0, 400),
          },
          { onConflict: 'endpoint' },
        )
        if (error) throw new Error('Couldn’t save this device. If someone else used Loot on it, sign them out first.')
      } else {
        const endpoint = await unsubscribePush()
        if (endpoint) await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: deviceKey(user?.id) })
      void queryClient.invalidateQueries({ queryKey: ['push_summary', user?.id] })
    },
  })
}

/** Saves one per-kind switch in profiles.notification_prefs (missing = on). */
export function useSetPushKind() {
  const update = useUpdateProfile()
  return {
    isPending: update.isPending,
    set(prefs: Record<string, boolean> | null | undefined, kind: string, on: boolean) {
      update.mutate({ notification_prefs: { ...(prefs ?? {}), [kind]: on } })
    },
  }
}

/** Records a push click (the service worker opens Loot with ?pushd=<delivery id>). */
export async function reportPushClick(deliveryId: number) {
  await supabase.rpc('mark_push_clicked', { delivery_id: deliveryId })
}
