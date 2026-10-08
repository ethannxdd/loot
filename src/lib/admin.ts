import { describeFunctionError, isFunctionMissing } from '@/lib/function-error'
import { supabase } from '@/lib/supabase'

/**
 * Admin portal data layer. Every read and fix goes through an `admin_*` database function (Migration 025),
 * and every account action that needs the service-role key goes through the `admin-actions` edge function.
 * Both check the caller's role and two-factor level themselves — nothing here is trusted for security.
 */

export type AdminRole = 'owner' | 'support' | 'viewer'

const RANK: Record<AdminRole, number> = { viewer: 1, support: 2, owner: 3 }

export function roleAtLeast(role: AdminRole | null | undefined, min: AdminRole): boolean {
  return !!role && RANK[role] >= RANK[min]
}

export const ROLE_LABEL: Record<AdminRole, string> = { owner: 'Owner', support: 'Support', viewer: 'Viewer' }

export interface AdminMe {
  role: AdminRole | null
  aal: 'aal1' | 'aal2' | string
}

export type Platform = 'browser' | 'pwa' | 'ios' | 'android'

export interface OverviewStats {
  range_days: number
  series_days: number
  users_total: number
  new_in_range: number
  new_prev_range: number | null
  active_today: number
  active_7d: number
  active_30d: number
  active_in_range: number
  peak_day: { day: string; active: number } | null
  platforms: Record<Platform, number>
  signin: { email: number; google: number; other: number }
  series: { day: string; signups: number; active: number }[]
  funnel: { signed_up: number; confirmed: number; onboarded: number; first_expense: number; three_months: number }
  adoption_basis: 'active' | 'onboarded'
  adoption_total: number
  adoption: Record<'expenses' | 'goals' | 'checker' | 'statements' | 'planner' | 'tax' | 'close' | 'bureau' | 'household', number>
  benchmarks: Record<'under_10k' | '10k_20k' | '20k_35k' | '35k_60k' | '60k_plus', number>
  attention: { unconfirmed: number; stuck: number; suspended: number; next_unsuspend: string | null }
}

export type UserStatus = 'active' | 'unconfirmed' | 'suspended'
export type UserFilter = 'all' | 'active' | 'unconfirmed' | 'suspended' | 'stuck' | 'admins'

export interface UserRow {
  id: string
  email: string | null
  display_name: string | null
  status: UserStatus
  created_at: string
  last_sign_in_at: string | null
  last_active_day: string | null
  onboarded: boolean
  platform: Platform | null
  provider: string
  admin_role: AdminRole | null
}

export interface UserList {
  total: number
  rows: UserRow[]
}

export interface AuditRow {
  id: number
  admin_id?: string | null
  admin_email: string | null
  action: string
  target_user_id?: string | null
  target_email?: string | null
  reason: string | null
  details: Record<string, unknown>
  created_at: string
}

export interface UserFlag {
  key: string
  description: string
  enabled_globally: boolean
  override: boolean | null
  override_reason: string | null
  effective: boolean
}

export interface UserDetail {
  account: {
    id: string
    email: string | null
    display_name: string | null
    created_at: string
    last_sign_in_at: string | null
    email_confirmed_at: string | null
    provider: string
    providers: string[]
    onboarded_at: string | null
    tutorial_completed: boolean
    in_household: boolean
    mfa: boolean
    admin_role: AdminRole | null
  }
  status: {
    status: 'active' | 'suspended'
    reason: string | null
    suspended_until: string | null
    sessions_revoked_at: string | null
    updated_at: string | null
    updated_by_email: string | null
  }
  usage: {
    expenses: number
    goals: number
    checks: number
    statements: number
    plans: number
    months: number
    notifications: number
    tax_profile: boolean
  }
  locked_months: string[]
  activity: { day: string; platform: Platform }[]
  last_active: { day: string; platform: Platform } | null
  flags: UserFlag[]
  history: AuditRow[]
}

export interface Flag {
  key: string
  description: string
  enabled_globally: boolean
  is_public: boolean
  overrides_on: number
  overrides_off: number
  updated_at: string
  updated_by_email: string | null
}

export interface FlagOverride {
  user_id: string
  email: string | null
  display_name: string | null
  enabled: boolean
  reason: string | null
  set_by_email: string | null
  created_at: string
}

export interface AuditList {
  total: number
  scope: 'everyone' | 'mine'
  rows: AuditRow[]
}

export interface TeamMember {
  user_id: string
  email: string | null
  display_name: string | null
  role: AdminRole
  mfa: boolean
  added_by_email: string | null
  created_at: string
}

/** Thrown when the server says the session needs two-factor; the portal sends people to the 2FA step. */
export class TwoFactorRequiredError extends Error {
  constructor() {
    super('Two-factor sign-in is required for the admin portal.')
    this.name = 'TwoFactorRequiredError'
  }
}

function friendly(message: string): Error {
  if (/two-factor required/i.test(message)) return new TwoFactorRequiredError()
  if (/not authorised/i.test(message)) return new Error('Your admin role doesn’t allow that.')
  return new Error(message)
}

/** Calls an admin database function and unwraps its JSON result. */
export async function adminRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw friendly(error.message)
  return data as T
}

export type AdminActionName = 'confirm_email' | 'send_password_reset' | 'send_magic_link' | 'sign_out_everywhere' | 'delete_user'

/** Runs an account action through the admin-actions edge function. */
export async function adminAction(
  action: AdminActionName,
  userId: string,
  opts: { reason?: string; confirmEmail?: string } = {},
): Promise<Record<string, unknown>> {
  const redirectTo =
    action === 'send_password_reset'
      ? `${window.location.origin}/reset-password`
      : action === 'send_magic_link'
        ? `${window.location.origin}/dashboard`
        : undefined
  const { data, error } = await supabase.functions.invoke('admin-actions', {
    body: { action, user_id: userId, reason: opts.reason, confirm_email: opts.confirmEmail, redirect_to: redirectTo },
  })
  if (error) {
    if (isFunctionMissing(error)) {
      throw new Error('The admin-actions function isn’t deployed on this Supabase project yet. Nothing was changed.')
    }
    throw friendly(await describeFunctionError(error))
  }
  return (data ?? {}) as Record<string, unknown>
}

/** Human labels for audit actions. */
export const ACTION_LABEL: Record<string, string> = {
  suspend: 'Suspended account',
  unsuspend: 'Lifted suspension',
  reset_onboarding: 'Reset onboarding',
  replay_tutorial: 'Turned the guided tour back on',
  unlock_month: 'Unlocked a month',
  remove_from_household: 'Removed from household',
  clear_notifications: 'Cleared notifications',
  set_flag: 'Changed a feature flag',
  create_flag: 'Created a feature flag',
  set_override: 'Changed feature access',
  add_admin: 'Added to the admin team',
  set_role: 'Changed admin role',
  remove_admin: 'Removed from the admin team',
  confirm_email: 'Confirmed email',
  send_password_reset: 'Sent password reset',
  send_magic_link: 'Sent sign-in link',
  sign_out_everywhere: 'Signed out everywhere',
  delete_user: 'Deleted account',
}

/** One line describing the extra details of an audit entry (flag name, month, role change…). */
export function describeAuditDetails(row: Pick<AuditRow, 'action' | 'details'>): string | null {
  const d = row.details ?? {}
  switch (row.action) {
    case 'set_flag':
      return `${String(d.flag)} → ${d.enabled ? 'on for everyone' : 'off for everyone'}`
    case 'create_flag':
      return String(d.flag)
    case 'set_override':
      return `${String(d.flag)} → ${d.enabled === null || d.enabled === undefined ? 'follows global setting' : d.enabled ? 'on' : 'off'}`
    case 'unlock_month':
      return typeof d.month === 'string' ? formatMonth(d.month) : null
    case 'set_role':
      return `${ROLE_LABEL[d.from as AdminRole] ?? d.from} → ${ROLE_LABEL[d.to as AdminRole] ?? d.to}`
    case 'add_admin':
    case 'remove_admin':
      return ROLE_LABEL[d.role as AdminRole] ?? null
    case 'suspend':
      return d.until ? `until ${formatDate(String(d.until))}` : 'until lifted'
    case 'clear_notifications':
      return typeof d.deleted === 'number' ? `${d.deleted} removed` : null
    case 'sign_out_everywhere':
      return typeof d.sessions_ended === 'number' && d.sessions_ended >= 0 ? `${d.sessions_ended} sessions ended` : null
    default:
      return null
  }
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  const date = d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  if (!withTime) return date
  return `${date}, ${d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
}

/** "Today", "Yesterday", "3 days ago", or a date. Takes a date (YYYY-MM-DD) or a timestamp. */
export function relativeDay(value: string | null | undefined, now = new Date()): string {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return '—'
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 45) return `${days} days ago`
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  browser: 'Browser',
  pwa: 'Installed app',
  ios: 'iOS app',
  android: 'Android app',
}

export const PROVIDER_LABEL: Record<string, string> = { email: 'Email', google: 'Google' }
