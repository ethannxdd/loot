/**
 * Financial identity — a plain-English read of the user's habits, built from their last (up to) six monthly
 * snapshots. It describes what the numbers show; it is not a personality test and never judges the person.
 */

export interface IdentitySnapshot {
  month: string
  net_income: number
  total_expenses: number
  disposable_income: number
  savings_rate: number
}

export type IdentityTone = 'good' | 'ok' | 'bad'

export interface IdentityDimension {
  label: string
  value: string
  tone: IdentityTone
  explain: string
}

export interface Identity {
  months: number
  dimensions: IdentityDimension[]
  summary: string
}

/** 0–1: how steady a series is (1 = identical every month). Uses the coefficient of variation. */
export function stability(values: number[]): number {
  if (values.length < 2) return 1
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean <= 0) return 1
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  const cv = Math.sqrt(variance) / mean
  return Math.max(0, Math.min(1, 1 - cv * 2))
}

/** Slope of a least-squares line through the values, as a fraction of the average magnitude, per month. */
export function trendSlope(values: number[]): number {
  if (values.length < 3) return 0
  const n = values.length
  const meanX = (n - 1) / 2
  const meanY = values.reduce((s, v) => s + v, 0) / n
  const num = values.reduce((s, v, i) => s + (i - meanX) * (v - meanY), 0)
  const den = values.reduce((s, _v, i) => s + (i - meanX) ** 2, 0) || 1
  return meanY !== 0 ? num / den / Math.abs(meanY) : 0
}

/**
 * @param snapshots  any order; the six most recent are used
 * @param dtiPct     monthly debt repayments as a percentage of gross income
 */
export function buildIdentity(snapshots: IdentitySnapshot[], dtiPct: number): Identity | null {
  const snaps = [...snapshots]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    // A month with no income and no spending recorded says nothing about behaviour.
    .filter((s) => s.net_income > 0 || s.total_expenses > 0)
  if (snaps.length === 0) return null

  const steady = stability(snaps.map((s) => s.total_expenses))
  const spending: IdentityDimension =
    snaps.length < 2
      ? { label: 'Spending pattern', value: 'Too early to tell', tone: 'ok', explain: 'One month of data isn’t enough to spot a pattern yet.' }
      : steady >= 0.75
        ? { label: 'Spending pattern', value: 'Consistent', tone: 'good', explain: 'Your monthly spending barely moves from month to month.' }
        : steady >= 0.5
          ? { label: 'Spending pattern', value: 'Seasonal', tone: 'ok', explain: 'Your spending moves in waves — some months are clearly heavier than others.' }
          : { label: 'Spending pattern', value: 'Variable', tone: 'bad', explain: 'Your spending swings a lot from month to month, which makes planning harder.' }

  const avgSavings = snaps.reduce((s, x) => s + x.savings_rate, 0) / snaps.length
  const savings: IdentityDimension =
    avgSavings >= 20
      ? { label: 'Savings behaviour', value: 'Strong saver', tone: 'good', explain: `You’ve averaged a ${avgSavings.toFixed(0)}% savings rate.` }
      : avgSavings >= 8
        ? { label: 'Savings behaviour', value: 'Building', tone: 'ok', explain: `You’ve averaged a ${avgSavings.toFixed(0)}% savings rate — steady, with room to grow.` }
        : { label: 'Savings behaviour', value: 'Needs attention', tone: 'bad', explain: `Your savings rate has averaged ${avgSavings.toFixed(0)}%.` }

  const debt: IdentityDimension =
    dtiPct <= 0.5
      ? { label: 'Debt position', value: 'Debt-free', tone: 'good', explain: 'No recurring debt repayments recorded.' }
      : dtiPct < 36
        ? { label: 'Debt position', value: 'Managed', tone: 'ok', explain: `Debt takes ${dtiPct.toFixed(0)}% of your gross income — inside the safe band.` }
        : { label: 'Debt position', value: 'High load', tone: 'bad', explain: `Debt takes ${dtiPct.toFixed(0)}% of your gross income, above the 36% lenders watch for.` }

  const slope = trendSlope(snaps.map((s) => s.disposable_income))
  const trajectory: IdentityDimension =
    snaps.length < 3
      ? { label: 'Financial trajectory', value: 'Too early to tell', tone: 'ok', explain: 'Loot needs three months of data to see which way things are heading.' }
      : slope > 0.03
        ? { label: 'Financial trajectory', value: 'Improving', tone: 'good', explain: 'Your disposable income has been climbing over the period.' }
        : slope < -0.03
          ? { label: 'Financial trajectory', value: 'Declining', tone: 'bad', explain: 'Your disposable income has been slipping over the period.' }
          : { label: 'Financial trajectory', value: 'Stable', tone: 'ok', explain: 'Your position has held roughly level over the period.' }

  const dimensions = [spending, savings, debt, trajectory]
  const rank = { good: 0, ok: 1, bad: 2 } as const
  const strongest = [...dimensions].sort((a, b) => rank[a.tone] - rank[b.tone])[0]
  const weakest = [...dimensions].sort((a, b) => rank[b.tone] - rank[a.tone])[0]

  const summary =
    `Over the last ${snaps.length} month${snaps.length === 1 ? '' : 's'}, your spending pattern reads as ${spending.value.toLowerCase()}, ` +
    `your savings behaviour as ${savings.value.toLowerCase()} and your trajectory as ${trajectory.value.toLowerCase()}. ` +
    (strongest.tone === weakest.tone
      ? ''
      : `Your strongest area is ${strongest.label.toLowerCase()} (${strongest.value}); the most room to improve is ${weakest.label.toLowerCase()} (${weakest.value}).`)

  return { months: snaps.length, dimensions, summary: summary.trim() }
}
