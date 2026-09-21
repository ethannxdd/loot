import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { syncNetWorthSnapshot } from '@/lib/net-worth'
import type { NetWorthItem, NewNetWorthItem } from '@/lib/types'
import { useAuth } from './useAuth'
import { useProfile } from './useProfile'

export function netWorthItemsQueryKey(userId: string | undefined) {
  return ['net_worth_items', userId] as const
}

export function useNetWorthItems() {
  const { user } = useAuth()
  return useQuery({
    queryKey: netWorthItemsQueryKey(user?.id),
    queryFn: async (): Promise<NetWorthItem[]> => {
      const { data, error } = await supabase
        .from('net_worth_items')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as NetWorthItem[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

async function resync(userId: string, currencyCode: string, queryClient: ReturnType<typeof useQueryClient>) {
  const { data } = await supabase.from('net_worth_items').select('*').eq('user_id', userId)
  await syncNetWorthSnapshot(userId, currencyCode, (data as NetWorthItem[]) ?? [])
  queryClient.invalidateQueries({ queryKey: ['monthly_snapshots', userId] })
}

export function useCreateNetWorthItem() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: NewNetWorthItem) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('net_worth_items')
        .insert({ ...item, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as NetWorthItem
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: netWorthItemsQueryKey(user?.id) })
      if (user && profile) await resync(user.id, profile.currency_code, queryClient)
    },
  })
}

export function useUpdateNetWorthItem() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NetWorthItem> }) => {
      const { data, error } = await supabase
        .from('net_worth_items')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as NetWorthItem
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: netWorthItemsQueryKey(user?.id) })
      if (user && profile) await resync(user.id, profile.currency_code, queryClient)
    },
  })
}

export function useDeleteNetWorthItem() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('net_worth_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: netWorthItemsQueryKey(user?.id) })
      if (user && profile) await resync(user.id, profile.currency_code, queryClient)
    },
  })
}
