export interface TaxBracket {
  upTo: number | null // null = no upper bound
  base: number
  rate: number // marginal rate, e.g. 0.18
  above: number // bracket floor the rate applies above
}

export interface TaxTable {
  taxYear: string // e.g. '2026/27'
  label: string // human label, e.g. '1 Mar 2026 – 28 Feb 2027'
  brackets: TaxBracket[]
  rebates: { primary: number; secondary: number; tertiary: number }
  thresholds: { under65: number; from65to74: number; from75: number }
  medicalCredit: { member: number; firstDependant: number; additionalDependant: number } // monthly, per SARS s6A
  raDeductionCap: number // annual cap in Rand, alongside the 27.5% of income rule
}

/**
 * SARS tax tables — sourced from SARS.gov.za and cross-checked against independent
 * summaries in September 2026. Verify against sars.gov.za before relying on this for
 * an actual return; South Africa's budget can revise these figures annually.
 */
export const TAX_TABLES: Record<string, TaxTable> = {
  '2025/26': {
    taxYear: '2025/26',
    label: '1 Mar 2025 – 28 Feb 2026',
    brackets: [
      { upTo: 237_100, base: 0, rate: 0.18, above: 0 },
      { upTo: 370_500, base: 42_678, rate: 0.26, above: 237_100 },
      { upTo: 512_800, base: 77_362, rate: 0.31, above: 370_500 },
      { upTo: 673_000, base: 121_475, rate: 0.36, above: 512_800 },
      { upTo: 857_900, base: 179_147, rate: 0.39, above: 673_000 },
      { upTo: 1_817_000, base: 251_258, rate: 0.41, above: 857_900 },
      { upTo: null, base: 644_489, rate: 0.45, above: 1_817_000 },
    ],
    rebates: { primary: 17_235, secondary: 9_444, tertiary: 3_145 },
    thresholds: { under65: 95_750, from65to74: 148_217, from75: 165_689 },
    medicalCredit: { member: 364, firstDependant: 364, additionalDependant: 246 },
    raDeductionCap: 350_000,
  },
  '2026/27': {
    taxYear: '2026/27',
    label: '1 Mar 2026 – 28 Feb 2027',
    brackets: [
      { upTo: 245_100, base: 0, rate: 0.18, above: 0 },
      { upTo: 383_100, base: 44_118, rate: 0.26, above: 245_100 },
      { upTo: 530_200, base: 79_998, rate: 0.31, above: 383_100 },
      { upTo: 695_800, base: 125_599, rate: 0.36, above: 530_200 },
      { upTo: 887_000, base: 185_215, rate: 0.39, above: 695_800 },
      { upTo: 1_878_600, base: 259_783, rate: 0.41, above: 887_000 },
      { upTo: null, base: 666_339, rate: 0.45, above: 1_878_600 },
    ],
    rebates: { primary: 17_820, secondary: 9_765, tertiary: 3_249 },
    thresholds: { under65: 99_000, from65to74: 153_250, from75: 171_300 },
    medicalCredit: { member: 376, firstDependant: 376, additionalDependant: 254 },
    raDeductionCap: 430_000,
  },
}

const KNOWN_YEARS = Object.keys(TAX_TABLES).sort()

/** SA tax years run 1 March – 28/29 February. Returns the tax year label for "today". */
export function getCurrentTaxYear(date = new Date()): string {
  const month = date.getMonth() + 1 // 1-12
  const startYear = month >= 3 ? date.getFullYear() : date.getFullYear() - 1
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** Looks up a tax table, falling back to the latest known year if the exact year isn't tabled yet. */
export function getTaxTable(taxYear: string): TaxTable {
  if (TAX_TABLES[taxYear]) return TAX_TABLES[taxYear]
  const fallback = KNOWN_YEARS[KNOWN_YEARS.length - 1]
  return TAX_TABLES[fallback]
}

export const AVAILABLE_TAX_YEARS = KNOWN_YEARS
