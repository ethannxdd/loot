import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SubscriptionReview } from '@/lib/types'
import { useAuth } from './useAuth'

export function subscriptionReviewsQueryKey(userId: string | undefined) {
  return ['subscription_reviews', userId] as const
}

export function useSubscriptionReviews() {
  const { user } = useAuth()
  return useQuery({
    queryKey: subscriptionReviewsQueryKey(user?.id),
    queryFn: async (): Promise<SubscriptionReview[]> => {
      const { data, error } = await supabase
        .from('subscription_reviews')
        .select('*')
        .eq('user_id', user!.id)
        .order('amount', { ascending: false })
      if (error) throw error
      return data as SubscriptionReview[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

/** Upserts a subscription candidate by service name (case-sensitive match on name). */
export function useUpsertSubscription() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { serviceName: string; amount: number; lastCharged: string }) => {
      if (!user) throw new Error('Not signed in')
      const { data: existing } = await supabase
        .from('subscription_reviews')
        .select('id')
        .eq('user_id', user.id)
        .eq('service_name', input.serviceName)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('subscription_reviews')
          .update({ amount: input.amount, last_charged: input.lastCharged })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('subscription_reviews').insert({
          user_id: user.id,
          service_name: input.serviceName,
          amount: input.amount,
          last_charged: input.lastCharged,
        })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subscriptionReviewsQueryKey(user?.id) }),
  })
}

export function useToggleSubscriptionCancel() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, markedCancel }: { id: string; markedCancel: boolean }) => {
      const { error } = await supabase
        .from('subscription_reviews')
        .update({ marked_cancel: markedCancel })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subscriptionReviewsQueryKey(user?.id) }),
  })
}
