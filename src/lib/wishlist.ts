import type { AffordabilityVerdict } from './types'

/**
 * Wishlist with cooling-off (Phase 6 §4.4, Rule 22). An item becomes ready at added_at + cooling-off; at that point the
 * affordability check is re-run with the numbers ON THAT DAY, never the numbers from when it was added.
 */

export const COOL_OFF_DAYS = [2, 7, 30] as const
export type CoolOffDays = (typeof COOL_OFF_DAYS)[number]

export const COOL_OFF_LABELS: Record<CoolOffDays, string> = { 2: '48 hours', 7: '7 days', 30: '30 days' }

export type WishlistStatus = 'waiting' | 'ready' | 'bought' | 'dropped' | 'snoozed'

/** Mirrors public.wishlist_items — Migration 029. */
export interface WishlistItem {
  id: string
  user_id: string
  name: string
  price: number
  url: string | null
  category: string | null
  cool_off_days: CoolOffDays
  added_at: string
  ready_at: string
  status: WishlistStatus
  snoozed_until: string | null
  decided_at: string | null
  verdict: AffordabilityVerdict | null
  verdict_reasoning: string | null
  tags: string[]
  target_price: number | null
  created_at: string
  updated_at: string
}

/** Default cooling-off: 48h under R1,000, 7 days above, 30 days above 10% of take-home. */
export function defaultCoolOff(price: number, takeHome: number): CoolOffDays {
  if (takeHome > 0 && price > takeHome * 0.1) return 30
  if (price >= 1000) return 7
  return 2
}

export function readyAt(addedAt: Date, days: CoolOffDays): Date {
  return new Date(addedAt.getTime() + days * 86_400_000)
}

/** The effective state at `now`: a waiting/snoozed item past its time is ready. */
export function effectiveStatus(item: Pick<WishlistItem, 'status' | 'ready_at' | 'snoozed_until'>, now = new Date()): WishlistStatus {
  if (item.status === 'bought' || item.status === 'dropped') return item.status
  if (item.status === 'snoozed') return item.snoozed_until && new Date(item.snoozed_until).getTime() > now.getTime() ? 'snoozed' : 'ready'
  if (item.status === 'ready') return 'ready'
  return new Date(item.ready_at).getTime() <= now.getTime() ? 'ready' : 'waiting'
}

/** Countdown: fraction of the cooling-off done (0–1) and a "Ready in 2 days" label. */
export function countdown(item: Pick<WishlistItem, 'added_at' | 'ready_at'>, now = new Date()): { fraction: number; label: string } {
  const start = new Date(item.added_at).getTime()
  const end = new Date(item.ready_at).getTime()
  const fraction = end > start ? Math.min(1, Math.max(0, (now.getTime() - start) / (end - start))) : 1
  const ms = end - now.getTime()
  if (ms <= 0) return { fraction: 1, label: 'Ready' }
  const hours = Math.ceil(ms / 3_600_000)
  if (hours < 24) return { fraction, label: `Ready in ${hours} hour${hours === 1 ? '' : 's'}` }
  const days = Math.ceil(ms / 86_400_000)
  return { fraction, label: `Ready in ${days} day${days === 1 ? '' : 's'}` }
}

/** "Dropped: R 4 350 not spent" — the all-time total of items the person decided against. */
export function savedByNotBuying(items: WishlistItem[]): number {
  return items.filter((i) => i.status === 'dropped').reduce((s, i) => s + Number(i.price), 0)
}

/** Snooze ("Not yet"): back to waiting for 7 days. */
export function snoozeUntil(now = new Date()): Date {
  return new Date(now.getTime() + 7 * 86_400_000)
}

/** Items that became ready on `today` — for the wishlist_ready notification (server). */
export function readyToday(items: WishlistItem[], today: Date): WishlistItem[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const end = start + 86_400_000
  return items.filter((i) => {
    if (i.status === 'bought' || i.status === 'dropped') return false
    const t = i.status === 'snoozed' && i.snoozed_until ? new Date(i.snoozed_until).getTime() : new Date(i.ready_at).getTime()
    return t <= end && t > start - 7 * 86_400_000 && effectiveStatus(i, new Date(end - 1)) === 'ready'
  })
}
