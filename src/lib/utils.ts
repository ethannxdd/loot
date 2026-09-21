import { type ClassValue, clsx } from 'clsx'

/** Merge conditional class names. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

const zarFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0,
})

/** Format a number as South African Rand, e.g. R 12,500. */
export function formatCurrency(amount: number, currencyCode = 'ZAR') {
  if (currencyCode === 'ZAR') return zarFormatter.format(amount)
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** "Good morning" / "Good afternoon" / "Good evening" based on local time. */
export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
