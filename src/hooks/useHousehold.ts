import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { monthlyEquivalent } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import type { Expense, Household, HouseholdInvite, HouseholdMember, Profile } from '@/lib/types'
import { useAuth } from './useAuth'
import { useExpenses } from './useExpenses'
import { useProfile, useUpdateProfile } from './useProfile'

export function householdQueryKey(userId: string | undefined) {
  return ['household', userId] as const
}

export interface MyHousehold {
  /** Only `id` is guaranteed: RLS lets just the owner read the `households` row itself. */
  household: { id: string }
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
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (membershipError) throw membershipError
      if (!myMembership) return null

      const [{ data: ownedHousehold, error: hError }, { data: members, error: mError }] = await Promise.all([
        // Non-owner members can't read the households row (owner-only RLS) — that's expected, not an error,
        // so this must be maybeSingle(): .single() would 406 for every partner.
        supabase.from('households').select('*').eq('id', myMembership.household_id).maybeSingle(),
        supabase.from('household_members').select('*').eq('household_id', myMembership.household_id),
      ])
      if (hError) throw hError
      if (mError) throw mError

      return {
        household: { id: myMembership.household_id as string },
        isOwner: (ownedHousehold as Household | null)?.owner_id === user!.id,
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
    queryKey: ['household_partner_profiles', [...partnerIds].sort().join(',')],
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
    queryKey: ['household_partner_expenses', [...partnerIds].sort().join(',')],
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
      if (mError) {
        // Don't leave an owner-less orphan household behind.
        await supabase.from('households').delete().eq('id', (household as Household).id)
        throw mError
      }
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
      // RLS also lets an owner read the invites they SENT, so filter to the ones addressed to me —
      // otherwise an owner sees their own outgoing invite as "you've been invited" with an Accept button.
      const { data, error } = await supabase
        .from('household_invites')
        .select('*')
        .eq('email', user!.email!.trim().toLowerCase())
        .neq('inviter_id', user!.id)
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
      const normalised = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) throw new Error("That doesn't look like a valid email address.")
      if (normalised === user.email?.toLowerCase()) throw new Error("That's your own email address.")

      const { data: existing, error: existingError } = await supabase
        .from('household_invites')
        .select('id')
        .eq('household_id', householdId)
        .eq('email', normalised)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
      if (existingError) throw existingError
      if (existing && existing.length > 0) throw new Error(`An invite to ${normalised} is already pending.`)

      const { error } = await supabase
        .from('household_invites')
        .insert({ household_id: householdId, inviter_id: user.id, email: normalised })
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

      const { data: mine, error: mineError } = await supabase
        .from('household_members')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
      if (mineError) throw mineError
      if (mine && mine.length > 0) {
        throw new Error('You already belong to a household. Leave it first to accept this invite.')
      }

      const { error: updateError } = await supabase
        .from('household_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
      if (updateError) throw updateError

      const { error: joinError } = await supabase
        .from('household_members')
        .insert({ household_id: invite.household_id, user_id: user.id })
      if (joinError) {
        // Put the invite back so the person can try again instead of being stranded with a used-up invite.
        await supabase.from('household_invites').update({ accepted_at: null }).eq('id', invite.id)
        throw joinError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: householdQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['household_invites_received', user?.email] })
      queryClient.invalidateQueries({ queryKey: ['household_partner_profiles'] })
      queryClient.invalidateQueries({ queryKey: ['household_partner_expenses'] })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: householdQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['household_partner_profiles'] })
      queryClient.invalidateQueries({ queryKey: ['household_partner_expenses'] })
    },
  })
}

/** Owner dissolves the household entirely (members and invites cascade away). */
export function useDisbandHousehold() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (householdId: string) => {
      const { error } = await supabase.from('households').delete().eq('id', householdId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: householdQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['household_partner_profiles'] })
      queryClient.invalidateQueries({ queryKey: ['household_partner_expenses'] })
    },
  })
}

export interface HouseholdView {
  /** The user has a household with at least one other member, so a combined view makes sense. */
  available: boolean
  /** Combined view is available AND switched on (profiles.household_view). */
  active: boolean
  toggle: () => void
  isToggling: boolean
  isLoading: boolean
  /** Expense rows from every member, each labelled with its owner (deleted ones included). */
  rows: HouseholdExpenseRow[]
  /** Live (not soft-deleted) expenses of every member — feed these to money.ts helpers for combined totals. */
  combinedExpenses: Expense[]
  /** Net / gross monthly income of everyone in the household (just the user's own when the view is off). */
  netIncome: number
  grossIncome: number
  partnerNames: string[]
}

/**
 * One place that answers "should this screen show me alone, or me + my partner?" (Business Rule 11).
 * When the view is off, `combinedExpenses`/`netIncome` are simply the user's own, so pages can use
 * them unconditionally.
 */
export function useHouseholdView(): HouseholdView {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const { data: household, isLoading: householdLoading } = useMyHousehold()
  const { data: myExpenses = [] } = useExpenses()

  const available = Boolean(household && household.members.length > 1)
  const active = Boolean(available && profile?.household_view)
  const memberIds = active && household ? household.members.map((m) => m.user_id) : []
  const { rows } = useHouseholdExpenses(memberIds, myExpenses)
  const { data: partnerProfiles = [] } = useHouseholdPartnerProfiles(memberIds)

  const ownIncome = { net: profile?.net_income ?? 0, gross: profile?.gross_income ?? 0 }
  const netIncome = ownIncome.net + (active ? partnerProfiles.reduce((s, p) => s + p.net_income, 0) : 0)
  const grossIncome = ownIncome.gross + (active ? partnerProfiles.reduce((s, p) => s + p.gross_income, 0) : 0)

  return {
    available,
    active,
    toggle: () => updateProfile.mutate({ household_view: !profile?.household_view }),
    isToggling: updateProfile.isPending,
    isLoading: householdLoading,
    rows: active ? rows : myExpenses.map((expense) => ({ expense, ownerLabel: 'You', isMine: true })),
    combinedExpenses: (active ? rows.map((r) => r.expense) : myExpenses).filter((e) => !e.deleted_at),
    netIncome,
    grossIncome,
    partnerNames: partnerProfiles.map((p) => p.display_name || 'Partner'),
  }
}
