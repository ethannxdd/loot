/**
 * Loot Score v2 — what the app is honest enough to show.
 *
 * Loot can't see credit history (accounts, missed payments, enquiries), so on its own it cannot produce a
 * credit score. It can rate money *habits* (budge-score.ts, five weighted factors stored in `budge_scores` on
 * a 0–999 internal index). So:
 *
 *  1. Not enough data  → no score, a checklist of what's missing.
 *  2. Habits only      → a 0–100 "money habits" rating + recommendations, and a prompt to add a real
 *                        bureau score to unlock an estimated credit score.
 *  3. Calibrated       → the user's latest real bureau score, on *that bureau's* scale, nudged by how their
 *                        habits have moved since it was reported (bounded). Adding a new bureau score
 *                        re-anchors it immediately.
 *
 * South African bureaus use different scales — TransUnion 0–999, Experian as shown by ClearScore 0–740,
 * legacy Compuscan 0–705 — so the scale travels with each logged score (`factors.scale_max`, see
 * LOOT-SCHEMA.md → bureau_scores).
 */
import type { BudgeScore, BureauScore, ScoreFactors } from './types'

export const INDEX_MAX = 999

export interface ScoreBand {
  min: number
  label: string
  tone: 'green' | 'amber' | 'red'
}

export interface BureauScale {
  max: number
  /** Bands, ascending by `min`. */
  bands: ScoreBand[]
  note: string
}

/** Published SA bands. Sources: TransUnion SA bands via JustMoney / LoanRating; Experian via ClearScore ZA. */
const SCALES: Record<number, BureauScale> = {
  999: {
    max: 999,
    note: 'TransUnion scale (0–999)',
    bands: [
      { min: 0, label: 'Poor', tone: 'red' },
      { min: 487, label: 'Below average', tone: 'red' },
      { min: 527, label: 'Average', tone: 'amber' },
      { min: 584, label: 'Fair', tone: 'amber' },
      { min: 670, label: 'Good', tone: 'green' },
      { min: 740, label: 'Very good', tone: 'green' },
      { min: 800, label: 'Excellent', tone: 'green' },
    ],
  },
  740: {
    max: 740,
    note: 'Experian scale as shown on ClearScore (0–740)',
    bands: [
      { min: 0, label: 'Very poor', tone: 'red' },
      { min: 599, label: 'Poor', tone: 'red' },
      { min: 616, label: 'Fair', tone: 'amber' },
      { min: 634, label: 'Good', tone: 'green' },
      { min: 658, label: 'Excellent', tone: 'green' },
    ],
  },
  705: {
    max: 705,
    note: 'Compuscan scale (0–705)',
    bands: [
      { min: 0, label: 'Poor', tone: 'red' },
      { min: 540, label: 'Fair', tone: 'amber' },
      { min: 583, label: 'Good', tone: 'green' },
      { min: 640, label: 'Excellent', tone: 'green' },
    ],
  },
}

/** The bureaus offered in the UI, with the scale their scores usually come on. */
export const BUREAU_OPTIONS = [
  { value: 'Experian', label: 'Experian (ClearScore)', defaultMax: 740 },
  { value: 'TransUnion', label: 'TransUnion', defaultMax: 999 },
  { value: 'XDS', label: 'XDS', defaultMax: 999 },
  { value: 'Compuscan', label: 'Compuscan', defaultMax: 705 },
] as const

export function defaultScaleMax(bureau: string): number {
  return BUREAU_OPTIONS.find((b) => b.value === bureau)?.defaultMax ?? 999
}

/** Generic bands for a scale Loot doesn't know — proportional to the TransUnion bands. */
export function scaleFor(max: number): BureauScale {
  if (SCALES[max]) return SCALES[max]
  const ref = SCALES[999]
  return { max, note: `0–${max} scale`, bands: ref.bands.map((b) => ({ ...b, min: Math.round((b.min / 999) * max) })) }
}

export function bandFor(score: number, scale: BureauScale): ScoreBand {
  let band = scale.bands[0]
  for (const b of scale.bands) if (score >= b.min) band = b
  return band
}

export function nextBand(score: number, scale: BureauScale): ScoreBand | null {
  return scale.bands.find((b) => b.min > score) ?? null
}

/** The scale a logged bureau score was reported on (stored in its jsonb `factors`). Old rows fall back by bureau. */
export function bureauScaleMax(b: Pick<BureauScore, 'bureau' | 'factors'>): number {
  const raw = (b.factors as Record<string, unknown> | null)?.scale_max
  return typeof raw === 'number' && raw > 0 ? raw : defaultScaleMax(b.bureau)
}

/** 0–100 money-habits rating from the internal 0–999 index. */
export function habitsRating(index: number) {
  return Math.round((Math.max(0, Math.min(INDEX_MAX, index)) / INDEX_MAX) * 100)
}

export function habitsLabel(rating: number): { label: string; tone: ScoreBand['tone'] } {
  if (rating >= 80) return { label: 'Strong habits', tone: 'green' }
  if (rating >= 60) return { label: 'Steady habits', tone: 'green' }
  if (rating >= 45) return { label: 'Mixed habits', tone: 'amber' }
  return { label: 'Needs attention', tone: 'red' }
}

/**
 * Estimated credit score: the latest real score, moved by the change in habits since it was reported.
 * A full swing of the habits index can move it at most ±6% of the scale — habits shift a bureau score
 * slowly, and Loot can't see most of what drives it.
 */
export function calibratedEstimate(anchor: BureauScore, currentIndex: number): number {
  const max = bureauScaleMax(anchor)
  const indexThen = anchor.estimated_score ?? currentIndex
  const drift = ((currentIndex - indexThen) / INDEX_MAX) * max * 0.06 * 4
  const bounded = Math.max(-max * 0.06, Math.min(max * 0.06, drift))
  return Math.round(Math.max(0, Math.min(max, anchor.score + bounded)))
}

export interface DataRequirement {
  key: 'income' | 'expenses' | 'history'
  label: string
  done: boolean
  detail?: string
}

export const MONTHS_NEEDED = 3

export type LootScoreView =
  | { status: 'insufficient'; requirements: DataRequirement[]; hasBureau: false }
  | {
      status: 'habits'
      rating: number
      habits: ReturnType<typeof habitsLabel>
      factors: ScoreFactors
      delta: number | null
      requirements: DataRequirement[]
    }
  | {
      status: 'calibrated'
      estimate: number
      scale: BureauScale
      band: ScoreBand
      next: ScoreBand | null
      anchor: BureauScore
      rating: number
      habits: ReturnType<typeof habitsLabel>
      factors: ScoreFactors
      delta: number | null
    }

export function buildLootScoreView(input: {
  netIncome: number
  expenseCount: number
  snapshotMonths: number
  latest: BudgeScore | null
  previous: BudgeScore | null
  bureauScores: BureauScore[]
}): LootScoreView {
  const requirements: DataRequirement[] = [
    { key: 'income', label: 'Add your take-home pay', done: input.netIncome > 0 },
    { key: 'expenses', label: 'Add your monthly expenses', done: input.expenseCount > 0 },
    {
      key: 'history',
      label: `Use Loot for ${MONTHS_NEEDED} months`,
      done: input.snapshotMonths >= MONTHS_NEEDED,
      detail: `${Math.min(input.snapshotMonths, MONTHS_NEEDED)} of ${MONTHS_NEEDED} months so far`,
    },
  ]
  const anchor = [...input.bureauScores].sort((a, b) => a.reported_on.localeCompare(b.reported_on)).at(-1) ?? null
  const basicsDone = requirements[0].done && requirements[1].done

  // A real bureau score is the strongest evidence there is, so it unlocks the estimate without waiting for history.
  if (anchor && basicsDone && input.latest) {
    const scale = scaleFor(bureauScaleMax(anchor))
    const estimate = calibratedEstimate(anchor, input.latest.score)
    const rating = habitsRating(input.latest.score)
    return {
      status: 'calibrated',
      estimate,
      scale,
      band: bandFor(estimate, scale),
      next: nextBand(estimate, scale),
      anchor,
      rating,
      habits: habitsLabel(rating),
      factors: input.latest.factors,
      delta: input.previous ? habitsRating(input.latest.score) - habitsRating(input.previous.score) : null,
    }
  }

  if (!requirements.every((r) => r.done) || !input.latest) {
    return { status: 'insufficient', requirements, hasBureau: false }
  }

  const rating = habitsRating(input.latest.score)
  return {
    status: 'habits',
    rating,
    habits: habitsLabel(rating),
    factors: input.latest.factors,
    delta: input.previous ? rating - habitsRating(input.previous.score) : null,
    requirements,
  }
}
