import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminAction,
  adminRpc,
  type AdminActionName,
  type AdminMe,
  type AdminRole,
  type AuditList,
  type Flag,
  type FlagOverride,
  type OverviewStats,
  type TeamMember,
  type UserDetail,
  type UserFilter,
  type UserList,
} from '@/lib/admin'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/** The signed-in person's admin role (null for everyone else). Quiet on failure: no role, no Admin link. */
export function useAdminMe() {
  const { user, session } = useAuth()
  return useQuery({
    // The session token is part of the key so a 2FA step-up (new aal2 token) refetches immediately.
    queryKey: ['admin', 'me', user?.id, session?.access_token?.slice(-16)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_me')
      if (error) throw error
      return data as AdminMe
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    retry: false,
    meta: { silent: true },
  })
}

const ADMIN = ['admin', 'data'] as const

export function useAdminOverview(days: number) {
  return useQuery({
    queryKey: [...ADMIN, 'overview', days],
    queryFn: () => adminRpc<OverviewStats>('admin_overview_stats', { p_days: days }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useAdminUsers(params: { search: string; filter: UserFilter; platform: string | null; page: number; pageSize: number }) {
  return useQuery({
    queryKey: [...ADMIN, 'users', params],
    queryFn: () =>
      adminRpc<UserList>('admin_list_users', {
        p_search: params.search || null,
        p_filter: params.filter,
        p_platform: params.platform,
        p_limit: params.pageSize,
        p_offset: params.page * params.pageSize,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useAdminUser(userId: string) {
  return useQuery({
    queryKey: [...ADMIN, 'user', userId],
    queryFn: () => adminRpc<UserDetail>('admin_user_detail', { p_user: userId }),
    staleTime: 15_000,
  })
}

export function useAdminFlags() {
  return useQuery({
    queryKey: [...ADMIN, 'flags'],
    queryFn: () => adminRpc<Flag[]>('admin_list_flags'),
    staleTime: 30_000,
  })
}

export function useAdminFlagOverrides(key: string | null) {
  return useQuery({
    queryKey: [...ADMIN, 'flag-overrides', key],
    queryFn: () => adminRpc<FlagOverride[]>('admin_flag_overrides', { p_key: key }),
    enabled: Boolean(key),
  })
}

export function useAdminAudit(params: { target: string | null; action: string | null; page: number; pageSize: number }) {
  return useQuery({
    queryKey: [...ADMIN, 'audit', params],
    queryFn: () =>
      adminRpc<AuditList>('admin_list_audit', {
        p_target: params.target,
        p_action: params.action,
        p_limit: params.pageSize,
        p_offset: params.page * params.pageSize,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminTeam(enabled: boolean) {
  return useQuery({
    queryKey: [...ADMIN, 'team'],
    queryFn: () => adminRpc<TeamMember[]>('admin_list_team'),
    enabled,
  })
}

/** Every admin change refreshes all admin data (lists, the user page, flags, audit, team). */
function useAdminMutation<V>(fn: (vars: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN }),
  })
}

export type DbAction =
  | { kind: 'suspend'; userId: string; reason: string; until: string | null }
  | { kind: 'unsuspend'; userId: string; reason?: string }
  | { kind: 'reset_onboarding'; userId: string; reason?: string }
  | { kind: 'replay_tutorial'; userId: string; reason?: string }
  | { kind: 'unlock_month'; userId: string; month: string; reason?: string }
  | { kind: 'remove_from_household'; userId: string; reason?: string }
  | { kind: 'clear_notifications'; userId: string; reason?: string }

export function useAdminDbAction() {
  return useAdminMutation((a: DbAction) => {
    const base = { p_user: a.userId, p_reason: a.reason ?? null }
    switch (a.kind) {
      case 'suspend':
        return adminRpc('admin_suspend', { ...base, p_until: a.until })
      case 'unlock_month':
        return adminRpc('admin_unlock_month', { ...base, p_month: a.month })
      default:
        return adminRpc(`admin_${a.kind}`, base)
    }
  })
}

export function useAdminAccountAction() {
  return useAdminMutation((v: { action: AdminActionName; userId: string; reason?: string; confirmEmail?: string }) =>
    adminAction(v.action, v.userId, { reason: v.reason, confirmEmail: v.confirmEmail }),
  )
}

export function useSetOverride() {
  return useAdminMutation((v: { userId: string; key: string; enabled: boolean | null; reason?: string }) =>
    adminRpc('admin_set_override', { p_user: v.userId, p_key: v.key, p_enabled: v.enabled, p_reason: v.reason ?? null }),
  )
}

export function useSetFlag() {
  return useAdminMutation((v: { key: string; enabled: boolean; reason?: string }) =>
    adminRpc('admin_set_flag', { p_key: v.key, p_enabled: v.enabled, p_reason: v.reason ?? null }),
  )
}

export function useCreateFlag() {
  return useAdminMutation((v: { key: string; description: string; isPublic: boolean }) =>
    adminRpc('admin_create_flag', { p_key: v.key, p_description: v.description, p_public: v.isPublic }),
  )
}

export function useTeamAction() {
  return useAdminMutation(
    (
      v:
        | { kind: 'add'; email: string; role: AdminRole; reason: string }
        | { kind: 'role'; userId: string; role: AdminRole; reason: string }
        | { kind: 'remove'; userId: string; reason: string },
    ) => {
      if (v.kind === 'add') return adminRpc('admin_add_admin', { p_email: v.email, p_role: v.role, p_reason: v.reason })
      if (v.kind === 'role') return adminRpc('admin_set_role', { p_user: v.userId, p_role: v.role, p_reason: v.reason })
      return adminRpc('admin_remove_admin', { p_user: v.userId, p_reason: v.reason })
    },
  )
}
