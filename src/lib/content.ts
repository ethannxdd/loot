import { CONTENT_DEFAULTS, type AppContent, type DutyBracket } from './content-defaults'
import { TAX_TABLES, type TaxTable } from './tax/tax-tables'

/**
 * Rule 24 — content fallback. Published values from app_content() are validated key by key (shape + sane ranges);
 * anything missing or invalid uses the bundled default, and the key is reported so the admin Overview can flag it.
 */

type Validator<T> = (v: unknown) => T | null

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const monthDay = (v: unknown): string | null => (typeof v === 'string' && /^\d{2}-\d{2}$/.test(v) ? v : null)

const validators: { [K in keyof AppContent]: Validator<AppContent[K]> } = {
  prime_rate: (v) => {
    if (!isObj(v)) return null
    const rate = num(v.rate, 3, 30)
    const effective = date(v.effective)
    return rate !== null && effective ? { rate, effective } : null
  },
  fuel_prices: (v) => {
    if (!isObj(v) || !isObj(v.petrol95) || !isObj(v.diesel)) return null
    const p = [num(v.petrol95.inland, 5, 80), num(v.petrol95.coastal, 5, 80), num(v.diesel.inland, 5, 80), num(v.diesel.coastal, 5, 80)]
    const effective = date(v.effective)
    if (p.some((x) => x === null) || !effective) return null
    return { effective, petrol95: { inland: p[0]!, coastal: p[1]! }, diesel: { inland: p[2]!, coastal: p[3]! } }
  },
  transfer_duty: (v) => {
    if (!isObj(v) || !Array.isArray(v.brackets) || v.brackets.length < 2) return null
    const brackets: DutyBracket[] = []
    for (const b of v.brackets) {
      if (!isObj(b)) return null
      const above = num(b.above, 0, 1e9)
      const base = num(b.base, 0, 1e9)
      const rate = num(b.rate, 0, 0.5)
      if (above === null || base === null || rate === null) return null
      if (brackets.length > 0 && above <= brackets[brackets.length - 1].above) return null
      brackets.push({ above, base, rate })
    }
    if (brackets[0].above !== 0) return null
    return { effective: date(v.effective) ?? '2025-04-01', brackets }
  },
  bond_costs: (v) => {
    if (!isObj(v)) return null
    const transferPct = num(v.transferPct, 0, 10)
    const bondPct = num(v.bondPct, 0, 10)
    const fixed = num(v.fixed, 0, 200_000)
    return transferPct !== null && bondPct !== null && fixed !== null ? { transferPct, bondPct, fixed } : null
  },
  tfsa_limits: (v) => {
    if (!isObj(v)) return null
    const annual = num(v.annual, 1_000, 1_000_000)
    const lifetime = num(v.lifetime, 10_000, 10_000_000)
    const penalty = num(v.penalty_pct, 0, 100)
    if (annual === null || lifetime === null || penalty === null || annual > lifetime) return null
    return { annual, lifetime, penalty_pct: penalty, from_tax_year: typeof v.from_tax_year === 'string' ? v.from_tax_year : '' }
  },
  two_pot: (v) => {
    if (!isObj(v)) return null
    const min = num(v.min_withdrawal, 0, 100_000)
    const per = num(v.per_tax_year, 1, 12)
    return min !== null && per !== null ? { min_withdrawal: min, per_tax_year: per } : null
  },
  assistant_daily_cap: (v) => num(typeof v === 'string' ? Number(v) : v, 0, 500),
  seasons: (v) => {
    if (!isObj(v) || !isObj(v.january_window)) return null
    const bf = date(v.black_friday)
    const after = num(v.black_friday_window_days_after, 0, 14)
    const start = monthDay(v.january_window.start)
    const end = monthDay(v.january_window.end)
    if (!bf || after === null || !start || !end) return null
    return { black_friday: bf, black_friday_window_days_after: after, january_window: { start, end } }
  },
  retirement_real_return_pct: (v) => num(typeof v === 'string' ? Number(v) : v, -5, 15),
  shortcut_url: (v) => (typeof v === 'string' && (v === '' || /^https:\/\/(www\.)?icloud\.com\/shortcuts\//.test(v)) ? v : null),
}

export interface ResolvedContent extends AppContent {
  /** Keys that were published but failed validation (Rule 24 — the admin Overview flags these). */
  invalid: string[]
  /** Raw published values, for keys this module doesn't model (e.g. tax_tables:<year>). */
  raw: Record<string, unknown>
}

/** Merges published content over the bundled defaults, validating each key. */
export function resolveContent(published: Record<string, unknown> | null | undefined): ResolvedContent {
  const out = { ...CONTENT_DEFAULTS } as AppContent
  const invalid: string[] = []
  for (const key of Object.keys(validators) as (keyof AppContent)[]) {
    if (!published || !(key in published)) continue
    const value = (validators[key] as Validator<unknown>)(published[key])
    if (value === null) invalid.push(key)
    else (out as unknown as Record<string, unknown>)[key] = value
  }
  for (const key of Object.keys(published ?? {})) {
    if (key.startsWith('tax_tables:') && validateTaxTable(published![key]) === null) invalid.push(key)
  }
  return { ...out, invalid, raw: published ?? {} }
}

/** Validates a published SARS table (brackets ascending, no gaps, bases consistent). Null if unusable. */
export function validateTaxTable(v: unknown): TaxTable | null {
  if (!isObj(v) || !Array.isArray(v.brackets) || !isObj(v.rebates) || !isObj(v.thresholds) || !isObj(v.medicalCredit)) return null
  const brackets = v.brackets as unknown[]
  if (brackets.length < 2) return null
  let prevUpTo = 0
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i]
    if (!isObj(b)) return null
    const above = num(b.above, 0, 1e9)
    const base = num(b.base, 0, 1e9)
    const rate = num(b.rate, 0, 0.6)
    const upTo = b.upTo === null ? null : num(b.upTo, 0, 1e9)
    if (above === null || base === null || rate === null) return null
    if (above !== prevUpTo) return null // no gaps / overlaps
    if (upTo === null && i !== brackets.length - 1) return null
    if (upTo !== null && upTo <= above) return null
    // The next bracket's base must equal this bracket's tax at its ceiling (±R2 rounding).
    const next = brackets[i + 1]
    if (upTo !== null && isObj(next) && Math.abs(Number(next.base) - (base + (upTo - above) * rate)) > 2) return null
    prevUpTo = upTo ?? prevUpTo
  }
  const r = v.rebates
  const t = v.thresholds
  const m = v.medicalCredit
  const nums = [r.primary, r.secondary, r.tertiary, t.under65, t.from65to74, t.from75, m.member, m.firstDependant, m.additionalDependant]
  if (nums.some((x) => num(x, 0, 1e7) === null)) return null
  if (num(v.raDeductionCap, 0, 1e8) === null || typeof v.taxYear !== 'string') return null
  return v as unknown as TaxTable
}

/** The tax table for a year: a valid published one wins, otherwise the bundled table (unchanged behaviour). */
export function taxTableFrom(raw: Record<string, unknown> | null | undefined, taxYear: string): TaxTable | null {
  const published = raw?.[`tax_tables:${taxYear}`]
  return validateTaxTable(published) ?? TAX_TABLES[taxYear] ?? null
}

/** Transfer duty on a property price using the (content) table. */
export function transferDuty(price: number, brackets: DutyBracket[]): number {
  if (!(price > 0)) return 0
  let b = brackets[0]
  for (const x of brackets) if (price > x.above) b = x
  return Math.round(b.base + (price - b.above) * b.rate)
}

/** Staleness warnings for the admin Overview / Content manager (§5.1). */
export function staleContent(c: AppContent, today = new Date()): string[] {
  const days = (iso: string) => (today.getTime() - new Date(`${iso}T00:00:00`).getTime()) / 86_400_000
  const out: string[] = []
  if (days(c.fuel_prices.effective) > 35) out.push('Fuel prices are more than 35 days old')
  if (days(c.prime_rate.effective) > 120) out.push('Prime rate hasn’t been checked in 120 days')
  const bf = new Date(`${c.seasons.black_friday}T00:00:00`)
  if (bf.getTime() < today.getTime() - 14 * 86_400_000) out.push('Next Black Friday date isn’t set')
  return out
}

/** Every valid published tax table, keyed by tax year (for setPublishedTaxTables). */
export function publishedTaxTables(raw: Record<string, unknown> | null | undefined): Record<string, TaxTable> {
  const out: Record<string, TaxTable> = {}
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (!key.startsWith('tax_tables:')) continue
    const t = validateTaxTable(value)
    if (t) out[key.slice('tax_tables:'.length)] = t
  }
  return out
}
