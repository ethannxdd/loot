import { type ClassValue, clsx } from 'clsx'

/** Merge conditional class names. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Currency formatting lives in format.ts (dependency-free, shared with the edge functions); re-exported here so the
// existing `@/lib/utils` imports keep working.
export { formatCurrency, formatCurrencyExact, getActiveCurrency, setActiveCurrency, splitCurrency } from './format'

/** "Good morning" / "Good afternoon" / "Good evening" based on local time. */
export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Two-letter initials for an avatar, from a display name or (failing that) an email. */
export function initials(name: string | null | undefined, email?: string | null): string {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0] || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}
