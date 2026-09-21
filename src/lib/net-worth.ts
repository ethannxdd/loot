import { currentMonthKey } from './money'
import { supabase } from './supabase'
import type { NetWorthItem } from './types'

export interface NetWorthTotals {
  assetsTotal: number
  liabilitiesTotal: number
  netWorth: number
}

/** Applies each item's depreciation_pct (annual, applied as a flat one-off haircut here) to its value. */
function effectiveValue(item: NetWorthItem) {
  if (item.depreciation_pct <= 0) return item.value
  return item.value * (1 - item.depreciation_pct / 100)
}

export function computeNetWorthTotals(items: NetWorthItem[]): NetWorthTotals {
  let assetsTotal = 0
  let liabilitiesTotal = 0
  for (const item of items) {
    const value = effectiveValue(item)
    if (item.kind === 'asset') assetsTotal += value
    else liabilitiesTotal += value
  }
  return { assetsTotal, liabilitiesTotal, netWorth: assetsTotal - liabilitiesTotal }
}

/**
 * Mirrors net worth totals onto the current month's snapshot row (Business Rule 9
 * territory) without touching its income/expense fields. Skips locked snapshots.
 * Creates a zeroed snapshot row first if this month has none yet.
 */
export async function syncNetWorthSnapshot(userId: string, currencyCode: string, items: NetWorthItem[]) {
  const month = currentMonthKey()
  const totals = computeNetWorthTotals(items)

  const { data: existing } = await supabase
    .from('monthly_snapshots')
    .select('id, locked_at')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle()

  if (existing?.locked_at) return

  if (existing) {
    await supabase
      .from('monthly_snapshots')
      .update({
        assets_total: totals.assetsTotal,
        liabilities_total: totals.liabilitiesTotal,
        net_worth: totals.netWorth,
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('monthly_snapshots').upsert(
      {
        user_id: userId,
        month,
        currency_code: currencyCode,
        assets_total: totals.assetsTotal,
        liabilities_total: totals.liabilitiesTotal,
        net_worth: totals.netWorth,
      },
      { onConflict: 'user_id,month' }
    )
  }
}
