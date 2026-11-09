/**
 * Bundled defaults for content-managed values (D11, Rule 24). The admin Content manager (B7) publishes newer values to
 * app_settings; the app reads them with app_content() and falls back to these whenever a value is missing, unpublished
 * or invalid — so nothing ever breaks.
 *
 * Sources checked 2026-11-09:
 *  - Prime 10.75%: SARB MPC 23 Sep 2026 raised repo to 7.25% (effective 25 Sep); prime = repo + 3.5.
 *    https://www.moneyweb.co.za/news/economy/sarb-ups-repo-rate-to-7-25/
 *  - Fuel 4 Nov 2026 (DMPR): 95 ULP inland R30.24, coastal R29.37; diesel 500ppm inland R30.85, coastal R29.98.
 *    https://stuff.co.za/2026/11/03/november-2026-official-fuel-prices-diesel-r1-20-l-cut/
 *  - Transfer duty (SARS, unchanged for 2026/27): https://www.sars.gov.za/tax-rates/transfer-duty/
 *  - TFSA R46,000 a year from 1 Mar 2026 (Budget 2026); lifetime R500,000; 40% on excess.
 *    https://www.10x.co.za/blog/tax-free-savings-account-limit-increased-to-r46-000-per-tax-year
 *  - Two-pot: one savings-component withdrawal per tax year, minimum R2,000.
 *  - Black Friday 2026: Friday 27 November.
 */

export interface PrimeRate {
  rate: number
  effective: string
}

export interface FuelPrices {
  effective: string
  petrol95: { inland: number; coastal: number }
  diesel: { inland: number; coastal: number }
}

export interface DutyBracket {
  /** Bracket floor (Rand). */
  above: number
  base: number
  /** Marginal rate, 0–1. */
  rate: number
}

export interface TransferDuty {
  effective: string
  brackets: DutyBracket[]
}

/** Attorney + deeds-office costs, as an estimate (percentages of price / bond plus a fixed amount). */
export interface BondCosts {
  transferPct: number
  bondPct: number
  fixed: number
}

export interface TfsaLimits {
  annual: number
  lifetime: number
  penalty_pct: number
  from_tax_year: string
}

export interface TwoPot {
  min_withdrawal: number
  per_tax_year: number
}

export interface Seasons {
  /** 'YYYY-MM-DD' */
  black_friday: string
  black_friday_window_days_after: number
  /** 'MM-DD' — Survive January card shows from start (in the year before) to end. */
  january_window: { start: string; end: string }
}

export interface AppContent {
  prime_rate: PrimeRate
  fuel_prices: FuelPrices
  transfer_duty: TransferDuty
  bond_costs: BondCosts
  tfsa_limits: TfsaLimits
  two_pot: TwoPot
  assistant_daily_cap: number
  seasons: Seasons
  /** Real (after-inflation) return used by the retirement projection, % a year. */
  retirement_real_return_pct: number
  /** iCloud link to the "Log to Loot" Shortcut (B2). Empty until Ethan publishes it. */
  shortcut_url: string
}

export const CONTENT_DEFAULTS: AppContent = {
  prime_rate: { rate: 10.75, effective: '2026-09-25' },
  fuel_prices: {
    effective: '2026-11-04',
    petrol95: { inland: 30.24, coastal: 29.37 },
    diesel: { inland: 30.85, coastal: 29.98 },
  },
  transfer_duty: {
    effective: '2025-04-01',
    brackets: [
      { above: 0, base: 0, rate: 0 },
      { above: 1_210_000, base: 0, rate: 0.03 },
      { above: 1_663_800, base: 13_614, rate: 0.06 },
      { above: 2_329_300, base: 53_544, rate: 0.08 },
      { above: 2_994_800, base: 106_784, rate: 0.11 },
      { above: 13_310_000, base: 1_241_456, rate: 0.13 },
    ],
  },
  bond_costs: { transferPct: 1.1, bondPct: 1.0, fixed: 3_500 },
  tfsa_limits: { annual: 46_000, lifetime: 500_000, penalty_pct: 40, from_tax_year: '2026/27' },
  two_pot: { min_withdrawal: 2_000, per_tax_year: 1 },
  assistant_daily_cap: 30,
  seasons: {
    black_friday: '2026-11-27',
    black_friday_window_days_after: 3,
    january_window: { start: '11-01', end: '01-15' },
  },
  retirement_real_return_pct: 4,
  shortcut_url: '',
}
