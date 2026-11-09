import { useState } from 'react'
import { docMoney } from '@/components/export/ExportDocs'
import { NumberField, ResultRow, ToolShell } from '@/components/tools/ToolShell'
import { useProfile } from '@/hooks/useProfile'
import { defaultMovingOutInputs, movingOut, type MovingOutInputs } from '@/lib/tools/moving-out'
import { formatCurrency } from '@/lib/utils'

/** /tools/moving-out (§4.5). */
export function MovingOutToolPage() {
  const { data: profile } = useProfile()
  const [inputs, setInputs] = useState<MovingOutInputs>(defaultMovingOutInputs)
  const set = (k: keyof MovingOutInputs) => (n: number) => setInputs((s) => ({ ...s, [k]: n }))
  const takeHome = profile?.net_income ?? 0
  const r = movingOut(inputs, takeHome)

  return (
    <ToolShell
      tool="moving_out"
      title="Moving out"
      subtitle="What your own place costs every month, the cash to get in, and the salary that covers it."
      inputs={inputs}
      onLoad={setInputs}
      headline={{ label: 'Every month', value: docMoney(r.monthly) }}
      exportRows={[
        { section: 'Every month', label: 'Rent', value: docMoney(inputs.rent) },
        { section: 'Every month', label: 'Water & electricity', value: docMoney(inputs.utilities) },
        { section: 'Every month', label: 'Internet', value: docMoney(inputs.internet) },
        { section: 'Every month', label: 'Groceries', value: docMoney(inputs.groceries) },
        { section: 'Every month', label: 'Transport', value: docMoney(inputs.transport) },
        { section: 'Every month', label: 'Other', value: docMoney(inputs.other) },
        { section: 'Every month', label: 'Total', value: docMoney(r.monthly), strong: true },
        { section: 'Getting in', label: 'Cash needed upfront', value: docMoney(r.upfront), strong: true },
        { section: 'Salary', label: 'Salary needed (before tax)', value: docMoney(r.grossNeeded) },
      ]}
      actions={{
        plannerItems: [
          { name: 'Rent', amount: inputs.rent, category: 'housing', frequency: 'monthly' },
          { name: 'Water & electricity', amount: inputs.utilities, category: 'housing', frequency: 'monthly' },
          { name: 'Internet', amount: inputs.internet, category: 'subscriptions', frequency: 'monthly' },
          { name: 'Groceries', amount: inputs.groceries, category: 'groceries', frequency: 'monthly' },
          { name: 'Transport', amount: inputs.transport, category: 'transport', frequency: 'monthly' },
          { name: 'Furniture & set-up', amount: inputs.onceOff, category: 'household', frequency: 'once-off' },
        ],
        check: { item: 'Moving out (monthly)', amount: r.monthly, recurring: true },
      }}
      form={
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="mo-rent" label="Rent" suffix="a month" value={inputs.rent} onChange={set('rent')} />
          <NumberField id="mo-dep" label="Deposit" suffix="months of rent" value={inputs.depositMonths} onChange={set('depositMonths')} />
          <NumberField id="mo-util" label="Water & electricity" value={inputs.utilities} onChange={set('utilities')} />
          <NumberField id="mo-net" label="Internet" value={inputs.internet} onChange={set('internet')} />
          <NumberField id="mo-groc" label="Groceries" value={inputs.groceries} onChange={set('groceries')} />
          <NumberField id="mo-trans" label="Transport" value={inputs.transport} onChange={set('transport')} />
          <NumberField id="mo-other" label="Other" suffix="a month" value={inputs.other} onChange={set('other')} />
          <NumberField id="mo-once" label="Furniture & set-up" suffix="once-off" value={inputs.onceOff} onChange={set('onceOff')} />
        </div>
      }
      results={
        <>
          <section className="card-elevated space-y-1 sm:p-6">
            <p className="text-[13px] text-muted-foreground">Every month</p>
            <p className="tnum text-[40px] leading-none font-bold tracking-[-0.04em]">{formatCurrency(r.monthly)}</p>
          </section>
          <section className="card">
            <ResultRow label="Cash to get in (deposit, first month, set-up)" value={formatCurrency(r.upfront)} strong />
            <ResultRow label="Salary that covers it (before tax)" value={formatCurrency(r.grossNeeded)} />
            {takeHome > 0 && (
              <ResultRow
                label={r.gap >= 0 ? 'Left from your take-home' : 'Short of your take-home'}
                value={formatCurrency(Math.abs(r.gap))}
                tone={r.gap >= 0 ? 'positive' : 'alert'}
                strong
              />
            )}
          </section>
        </>
      }
    />
  )
}
