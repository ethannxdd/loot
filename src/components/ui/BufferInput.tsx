import { useState } from 'react'
import { getActiveCurrency } from '@/lib/utils'

interface BufferInputProps {
  /** Monthly take-home pay the percentage applies to. */
  netIncome: number
  /** The buffer as a percentage string (what gets saved). */
  pct: string
  onPctChange: (pct: string) => void
  currency?: string
  idPrefix?: string
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp

/**
 * Safety buffer as either a percentage of take-home pay or a rand amount — the two fields stay linked.
 * Only the percentage is stored (profiles.safety_buffer_pct); typing an amount converts it.
 */
export function BufferInput({ netIncome, pct, onPctChange, currency = getActiveCurrency(), idPrefix = 'buffer' }: BufferInputProps) {
  // While the amount field is being typed in, show exactly what was typed rather than the re-derived value.
  const [amountDraft, setAmountDraft] = useState<string | null>(null)
  const canConvert = netIncome > 0
  const derivedAmount = canConvert && pct !== '' && Number.isFinite(Number(pct)) ? String(Math.round((netIncome * Number(pct)) / 100)) : ''
  const amount = amountDraft ?? derivedAmount
  const symbol = (() => {
    try {
      return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? 'R'
    } catch {
      return 'R'
    }
  })()

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-pct`}>
          Percent of take-home
        </label>
        <div className="relative">
          <input
            id={`${idPrefix}-pct`}
            type="number"
            inputMode="decimal"
            min={0}
            max={50}
            step="any"
            value={pct}
            onChange={(e) => {
              setAmountDraft(null)
              onPctChange(e.target.value)
            }}
            className="pr-9"
          />
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[15px] text-muted-foreground">%</span>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-amount`}>
          Or an amount a month
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] text-muted-foreground">{symbol}</span>
          <input
            id={`${idPrefix}-amount`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            disabled={!canConvert}
            placeholder={canConvert ? '0' : 'Add income first'}
            value={amount}
            onChange={(e) => {
              setAmountDraft(e.target.value)
              const n = Number(e.target.value)
              if (e.target.value === '' || !Number.isFinite(n)) return
              onPctChange(String(round((n / netIncome) * 100, 2)))
            }}
            onBlur={() => setAmountDraft(null)}
            className="pl-8"
          />
        </div>
      </div>
    </div>
  )
}
