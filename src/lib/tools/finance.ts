/** Shared loan maths for the tools (Phase 6 §4.5). Pure. */

/**
 * Monthly instalment for a loan of `principal` over `months` at `annualRatePct`, with an optional balloon (a lump sum
 * still owed at the end). Standard annuity: PMT = (P − B·v^n)·r / (1 − v^n), v = 1/(1+r).
 */
export function instalment(principal: number, annualRatePct: number, months: number, balloon = 0): number {
  if (!(months > 0) || !(principal > 0)) return 0
  const r = annualRatePct / 100 / 12
  if (r === 0) return (principal - balloon) / months
  const v = Math.pow(1 + r, -months)
  return ((principal - balloon * v) * r) / (1 - v)
}

/** Outstanding balance after `paid` instalments. */
export function balanceAfter(principal: number, annualRatePct: number, payment: number, paid: number): number {
  const r = annualRatePct / 100 / 12
  if (r === 0) return Math.max(0, principal - payment * paid)
  const g = Math.pow(1 + r, paid)
  return principal * g - (payment * (g - 1)) / r
}

/** Future value of a lump sum at a yearly rate. */
export function futureValue(amount: number, annualRatePct: number, years: number): number {
  return amount * Math.pow(1 + annualRatePct / 100, years)
}

export const round2 = (n: number) => Math.round(n * 100) / 100
