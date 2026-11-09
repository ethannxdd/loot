import { instalment, round2 } from './finance'

/** True cost of a car (Phase 6 §4.5). Pure — content defaults (prime, fuel price) are passed in. */

export interface CarInputs {
  price: number
  deposit: number
  termMonths: number
  ratePct: number
  balloonPct: number
  insuranceMonthly: number
  kmPerMonth: number
  litresPer100km: number
  fuelPrice: number
  servicePerYear: number
  tyresPerYear: number
  licenceTrackingPerYear: number
}

export interface CarResult {
  financed: number
  balloon: number
  instalment: number
  fuelMonthly: number
  runningMonthly: number
  /** Instalment + insurance + fuel + yearly costs ÷ 12. */
  trueMonthly: number
  totalPaid: number
  totalInterest: number
  breakdown: { key: string; label: string; amount: number }[]
}

export function defaultCarInputs(prime: number, fuelPrice: number): CarInputs {
  return {
    price: 300_000,
    deposit: 30_000,
    termMonths: 72,
    ratePct: Math.round((prime + 2) * 100) / 100,
    balloonPct: 0,
    insuranceMonthly: 1_200,
    kmPerMonth: 1_500,
    litresPer100km: 7,
    fuelPrice,
    servicePerYear: 4_500,
    tyresPerYear: 2_500,
    licenceTrackingPerYear: 2_400,
  }
}

export function carCost(i: CarInputs): CarResult {
  const financed = Math.max(0, i.price - i.deposit)
  const balloon = (i.price * Math.max(0, i.balloonPct)) / 100
  const pmt = instalment(financed, i.ratePct, i.termMonths, balloon)
  const fuelMonthly = (i.kmPerMonth / 100) * i.litresPer100km * i.fuelPrice
  const yearly = (i.servicePerYear + i.tyresPerYear + i.licenceTrackingPerYear) / 12
  const runningMonthly = i.insuranceMonthly + fuelMonthly + yearly
  const totalPaid = i.deposit + pmt * i.termMonths + balloon
  return {
    financed,
    balloon: round2(balloon),
    instalment: round2(pmt),
    fuelMonthly: round2(fuelMonthly),
    runningMonthly: round2(runningMonthly),
    trueMonthly: round2(pmt + runningMonthly),
    totalPaid: round2(totalPaid),
    totalInterest: round2(totalPaid - i.price),
    breakdown: [
      { key: 'instalment', label: 'Instalment', amount: round2(pmt) },
      { key: 'insurance', label: 'Insurance', amount: round2(i.insuranceMonthly) },
      { key: 'fuel', label: 'Fuel', amount: round2(fuelMonthly) },
      { key: 'upkeep', label: 'Service, tyres, licence', amount: round2(yearly) },
    ],
  }
}
