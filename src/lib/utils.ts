import { type ClassValue, clsx } from 'clsx'

/** Merge conditional class names. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/**
 * The currency figures are shown in — the signed-in user's `profiles.currency_code`. It is set once by the
 * app shell when the profile loads, so the ~100 call sites that just say `formatCurrency(x)` follow the
 * user's chosen currency instead of always printing Rand.
 */
let activeCurrency = 'ZAR'

export function setActiveCurrency(code: string | null | undefined) {
  if (code && /^[A-Z]{3}$/.test(code)) activeCurrency = code
}

export function getActiveCurrency(): string {
  return activeCurrency
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(currencyCode: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${currencyCode}:${fractionDigits}`
  let f = formatters.get(key)
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })
    } catch {
      // Unknown currency code — fall back to plain rand rather than crashing the page.
      f = new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })
    }
    formatters.set(key, f)
  }
  return f
}

/** Whole-unit money for headline figures, e.g. R 12 500. Uses the user's currency unless one is given. */
export function formatCurrency(amount: number, currencyCode: string = activeCurrency) {
  if (!Number.isFinite(amount)) return '—'
  return formatterFor(currencyCode, 0).format(Math.round(amount) === 0 ? 0 : amount)
}

/** Money with cents when there are any — for amounts the user typed in themselves (R 32.50 must not read R 33). */
export function formatCurrencyExact(amount: number, currencyCode: string = activeCurrency) {
  if (!Number.isFinite(amount)) return '—'
  const hasCents = Math.abs(amount - Math.round(amount)) >= 0.005
  return formatterFor(currencyCode, hasCents ? 2 : 0).format(amount)
}

/** "Good morning" / "Good afternoon" / "Good evening" based on local time. */
export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
