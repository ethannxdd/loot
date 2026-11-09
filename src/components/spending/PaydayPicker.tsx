import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { PAYDAY_RULE_LABELS, paydayPreview, type PaydayRule, type PaydayValue } from '@/lib/cycle'

const DAY_OPTIONS = [
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: ordinal(i + 1) })),
  { value: 'last', label: 'Last working day' },
]

function ordinal(n: number) {
  const s = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `${n}${s}`
}

/**
 * Payday field (§3.1): day picker (1–31 or Last working day) + "If it falls on a weekend or public holiday" and a live
 * preview of the cycle it gives. `allowUnset` adds "Not set — use calendar months".
 */
export function PaydayPicker({
  value,
  onChange,
  idPrefix,
  allowUnset = false,
  dark = false,
}: {
  value: PaydayValue
  onChange: (v: PaydayValue) => void
  idPrefix: string
  allowUnset?: boolean
  /** Preview text for a dark surface. */
  dark?: boolean
}) {
  const selectValue = value.rule === 'last_working_day' ? 'last' : value.day == null ? 'none' : String(value.day)
  const options = allowUnset ? [{ value: 'none', label: 'Not set — use calendar months' }, ...DAY_OPTIONS] : DAY_OPTIONS
  return (
    <div className="space-y-3">
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-day`}>
          Payday
        </label>
        <Select
          id={`${idPrefix}-day`}
          value={selectValue}
          onValueChange={(v) => {
            if (v === 'last') onChange({ day: value.day ?? 31, rule: 'last_working_day' })
            else if (v === 'none') onChange({ day: null, rule: 'previous_working_day' })
            else onChange({ day: Number(v), rule: value.rule === 'last_working_day' ? 'previous_working_day' : value.rule })
          }}
          options={options}
        />
      </div>
      {value.day != null && value.rule !== 'last_working_day' && (
        <div>
          <span className="field-label">If it falls on a weekend or public holiday</span>
          <Segmented
            full
            label="If payday falls on a weekend or public holiday"
            value={value.rule as Exclude<PaydayRule, 'last_working_day'>}
            onChange={(rule) => onChange({ ...value, rule })}
            options={(Object.keys(PAYDAY_RULE_LABELS) as Exclude<PaydayRule, 'last_working_day'>[]).map((r) => ({
              value: r,
              label: PAYDAY_RULE_LABELS[r],
            }))}
          />
        </div>
      )}
      <p className={`tnum text-[13px] ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>{paydayPreview(value)}</p>
    </div>
  )
}
