import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { monthlyEquivalent } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import type { Expense, Household, HouseholdInvite, HouseholdMember, Profile } from '@/lib/types'
import { useAuth } from './useAuth'

export function householdQueryKey(userId: string | undefined) {
  return ['household', userId] as const
}

export interface MyHousehold {
  household: Household
  isOwner: boolean
  members: HouseholdMember[]
}

/** The current user's household (as owner or member), including all member rows, or null. */
export function useMyHousehold() {
  const { user } = useAuth()
  return useQuery({
    queryKey: householdQueryKey(user?.id),
    queryFn: async (): Promise<MyHousehold | null> => {
      const { data: myMembership, error: membershipError } = await supabase
        .from('household_members')
        .select('*')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle()
      if (membershipError) throw membershipError
      if (!myMembership) return null

      const [{ data: household, error: hError }, { data: members, error: mError }] = await Promise.all([
        supabase.from('households').select('*').eq('id', myMembership.household_id).single(),
        supabase.from('household_members').select('*').eq('household_id', myMembership.household_id),
      ])
      if (hError) throw hError
      if (mError) throw mError

      return {
        household: household as Household,
        isOwner: (household as Household).owner_id === user!.id,
        members: members as HouseholdMember[],
      }
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

/** Profiles of the current household's other member(s) — readable per Migration 022. */
export function useHouseholdPartnerProfiles(memberUserIds: string[]) {
  const { user } = useAuth()
  const partnerIds = memberUserIds.filter((id) => id !== user?.id)
  return useQuery({
    queryKey: ['household_partner_profiles', partnerIds.sort().join(',')],
    queryFn: async (): Promise<Profile[]> => {
      if (partnerIds.length === 0) return []
      const { data, error } = await supabase.from('profiles').select('*').in('id', partnerIds)
      if (error) throw error
      return data as Profile[]
    },
    enabled: partnerIds.length > 0,
    staleTime: 10_000,
  })
}

export interface HouseholdExpenseRow {
  expense: Expense
  ownerLabel: string
  isMine: boolean
}

/**
 * Combines the current user's own (already-fetched) expenses with their household
 * partner's — readable cross-user thanks to Migration 022 — for the Household view
 * toggle on the Expenses page (Business Rule 11: "each expense labelled with owner").
 */
export function useHouseholdExpenses(memberUserIds: string[], myExpenses: Expense[]) {
  const { user } = useAuth()
  const partnerIds = memberUserIds.filter((id) => id !== user?.id)
  const { data: partnerProfiles = [] } = useHouseholdPartnerProfiles(memberUserIds)

  const { data: partnerExpenses = [] } = useQuery({
    queryKey: ['household_partner_expenses', partnerIds.sort().join(',')],
    queryFn: async (): Promise<Expense[]> => {
      if (partnerIds.length === 0) return []
      const { data, error } = await supabase.from('expenses').select('*').in('user_id', partnerIds)
      if (error) throw error
      return data as Expense[]
    },
    enabled: partnerIds.length > 0,
    staleTime: 10_000,
  })

  if (memberUserIds.length === 0) {
    return { rows: [] as HouseholdExpenseRow[], combinedTotal: 0 }
  }

  const nameFor = (userId: string) => {
    if (userId === user?.id) return 'You'
    return partnerProfiles.find((p) => p.id === userId)?.display_name || 'Partner'
  }

  const rows: HouseholdExpenseRow[] = [
    ...myExpenses.map((e) => ({ expense: e, ownerLabel: 'You', isMine: true })),
    ...partnerExpenses.map((e) => ({ expense: e, ownerLabel: nameFor(e.user_id), isMine: false })),
  ]

  const combinedTotal = rows
    .filter((r) => !r.expense.deleted_at)
    .reduce((sum, r) => sum + monthlyEquivalent(r.expense), 0)

  return { rows, combinedTotal }
}

export function useCreateHousehold() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in')
      const { data: household, error: hError } = await supabase
        .from('households')
        .insert({ owner_id: user.id })
        .select()
        .single()
      if (hError) throw hError
      const { error: mError } = await supabase
        .from('household_members')
        .insert({ household_id: (household as Household).id, user_id: user.id })
      if (mError) throw mError
      return household as Household
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: householdQueryKey(user?.id) }),
  })
}

export function useHouseholdInvites(householdId: string | undefined) {
  return useQuery({
    queryKey: ['household_invites_sent', householdId],
    queryFn: async (): Promise<HouseholdInvite[]> => {
      const { data, error } = await supabase
        .from('household_invites')
        .select('*')
        .eq('household_id', householdId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as HouseholdInvite[]
    },
    enabled: Boolean(householdId),
    staleTime: 10_000,
  })
}

/** Invites addressed to the current user's own account email, not yet accepted. */
export function useMyPendingInvites() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['household_invites_received', user?.email],
    queryFn: async (): Promise<HouseholdInvite[]> => {
      const { data, error } = await supabase
        .from('household_invites')
        .select('*')
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as HouseholdInvite[]
    },
    enabled: Boolean(user?.email),
    staleTime: 10_000,
  })
}

export function useSendHouseholdInvite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ householdId, email }: { householdId: string; email: string }) => {
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase
        .from('household_invites')
        .insert({ household_id: householdId, inviter_id: user.id, email: email.trim().toLowerCase() })
      if (error) throw error
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['household_invites_sent', variables.householdId] }),
  })
}

export function useRevokeHouseholdInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; householdId: string }) => {
      const { error } = await supabase.from('household_invites').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['household_invites_sent', variables.householdId] }),
  })
}

/** Accepts a pending invite: marks it accepted, then joins the invitee to household_members. */
export function useAcceptHouseholdInvite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (invite: HouseholdInvite) => {
      if (!user) throw new Error('Not signed in')
      const { error: updateError } = await supabase
        .from('household_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
      if (updateError) throw updateError

      const { error: joinError } = await supabase
        .from('household_members')
        .insert({ household_id: invite.household_id, user_id: user.id })
      if (joinError) throw joinError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: householdQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['household_invites_received', user?.email] })
    },
  })
}

/** Owner removes a member, or a member removes themselves (leave). */
export function useRemoveHouseholdMember() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (memberRowId: string) => {
      const { error } = await supabase.from('household_members').delete().eq('id', memberRowId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: householdQueryKey(user?.id) }),
  })
}
