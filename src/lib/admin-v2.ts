/**
 * Admin portal v2 (Phase 6 B7, Migration 032) — types and labels. Every call still goes through an admin_* database
 * function that checks role + two-factor itself; counts only, no money (Rule 26).
 */
import { ACTION_LABEL } from './admin'

export type FeedbackKind = 'problem' | 'idea' | 'question'
export type FeedbackStatus = 'new' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed'
export type FeedbackPriority = 'low' | 'normal' | 'high'

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  problem: 'Something’s not working',
  idea: 'Idea or improvement',
  question: 'Question',
}
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  waiting_on_user: 'Waiting on user',
  resolved: 'Resolved',
  closed: 'Closed',
}

export interface FeedbackRow {
  id: string
  kind: FeedbackKind
  first_line: string
  email: string | null
  user_id: string
  status: FeedbackStatus
  priority: FeedbackPriority
  created_at: string
  last_activity_at: string
  assigned_to_email: string | null
  platform: string | null
  awaiting_admin: boolean
}

export interface FeedbackList {
  counts: Record<FeedbackStatus, number>
  unanswered: number
  total: number
  rows: FeedbackRow[]
}

export interface FeedbackMessage {
  id: string
  sender: 'user' | 'admin'
  body: string
  created_at: string
  admin_email?: string | null
}

export interface FeedbackDetail {
  id: string
  kind: FeedbackKind
  message: string
  context: Record<string, string | number | null>
  status: FeedbackStatus
  priority: FeedbackPriority
  assigned_to: string | null
  created_at: string
  first_response_at: string | null
  resolved_at: string | null
  user: { id: string; email: string | null; display_name: string | null; created_at: string; suspended: boolean }
  messages: FeedbackMessage[]
  notes: { id: string; body: string; created_at: string; admin_email: string | null }[]
  other_threads: { id: string; kind: FeedbackKind; status: FeedbackStatus; created_at: string }[]
}

export interface SavedReply {
  id: string
  title: string
  body: string
}

export interface ContentSetting {
  key: string
  value: unknown
  draft: unknown
  published_at: string | null
  updated_at: string
  published_by_email: string | null
  min_role: 'owner' | 'support'
}

export interface AdminPriceEvent {
  id: string
  kind: string
  title: string
  description: string
  effective_on: string
  category: string
  change_pct: number | null
  change_amount: number | null
  change_unit: 'c/l' | 'R' | null
  region: 'all' | 'inland' | 'coastal'
  source_url: string | null
  status: 'draft' | 'published' | 'archived'
}

export interface ContentList {
  settings: ContentSetting[]
  price_events: AdminPriceEvent[]
}

export type AnnouncementStyle = 'info' | 'good' | 'heads_up'
export type AnnouncementChannel = 'banner' | 'bell' | 'push'
export type AnnouncementStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'

export interface Audience {
  all?: boolean
  platforms?: ('browser' | 'pwa' | 'ios' | 'android')[]
  flag?: string
  onboarded?: boolean
  inactive_days?: number
  signed_up_from?: string
  signed_up_to?: string
  user_id?: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  link: string | null
  style: AnnouncementStyle
  channels: AnnouncementChannel[]
  audience: Audience
  starts_at: string | null
  ends_at: string | null
  status: AnnouncementStatus
  recipient_count: number | null
  sent_at: string | null
  created_at: string
  clicked: number
}

export interface AnnouncementStats {
  recipients: number
  seen: number
  clicked: number
  dismissed: number
  pushed: number
  push_clicked: number
}

/** Overview additions from Migration 032 (merged into OverviewStats). */
export interface OverviewPhase6 {
  push_opt_in?: { subscribed: number; active_7d: number }
  loggers_7d?: number
  phase6_attention?: { unanswered_feedback_48h: number; stale_content: number; push_failure_rate_24h: number; missing_tax_table: boolean }
}

/** User page additions from Migration 032. */
export interface UserPhase6 {
  phase6?: {
    payday_set: boolean | null
    push_devices: { platform: string; created_at: string; last_success_at: string | null }[]
    capture_key: { active: boolean; created_at: string; last_used_at: string | null; total_uses: number } | null
    feedback: { id: string; kind: FeedbackKind; status: FeedbackStatus; created_at: string }[]
  }
}

/** Audience summary in plain words. */
export function describeAudience(a: Audience): string {
  if (a.user_id) return 'One person'
  if (a.all) return 'Everyone'
  const parts: string[] = []
  if (a.platforms?.length) parts.push(a.platforms.map((p) => (p === 'pwa' ? 'installed app' : p)).join(' or '))
  if (a.flag) parts.push(`has ${a.flag}`)
  if (a.onboarded !== undefined) parts.push(a.onboarded ? 'onboarded' : 'not onboarded')
  if (a.inactive_days) parts.push(`inactive ${a.inactive_days}+ days`)
  if (a.signed_up_from || a.signed_up_to) parts.push(`signed up ${a.signed_up_from ?? '…'} – ${a.signed_up_to ?? '…'}`)
  return parts.join(' · ') || 'Everyone'
}

Object.assign(ACTION_LABEL, {
  feedback_reply: 'Replied to feedback',
  feedback_note: 'Added an internal note',
  feedback_update: 'Updated a feedback thread',
  saved_reply_save: 'Saved a reply template',
  saved_reply_delete: 'Deleted a reply template',
  content_draft: 'Saved a content draft',
  content_publish: 'Published content',
  price_event_save: 'Saved a price change',
  price_event_status: 'Changed a price change’s status',
  announcement_save: 'Saved an announcement',
  announcement_send: 'Sent an announcement',
  announcement_cancel: 'Cancelled an announcement',
  clear_push: 'Cleared push devices',
  revoke_capture_key: 'Revoked Apple Pay capture key',
  reset_assistant_limit: 'Reset today’s Ask Loot limit',
  test_push: 'Sent a test push',
})

/** CSV from rows of plain values (Analytics → Export CSV). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}

export function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name.endsWith('.csv') ? name : `${name}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Content keys and who may edit them (mirrors admin_content_min_role in 032). */
export function contentMinRole(key: string): 'owner' | 'support' {
  return key.startsWith('tax_tables:') || ['tfsa_limits', 'two_pot', 'transfer_duty', 'bond_costs', 'assistant_daily_cap', 'retirement_real_return_pct'].includes(key)
    ? 'owner'
    : 'support'
}
