import { useState } from 'react'
import { docMoney } from '@/components/export/ExportDocs'
import { NumberField, ResultRow, StackedBar, ToolShell } from '@/components/tools/ToolShell'
import { Segmented } from '@/components/ui/Segmented'
import { useContent } from '@/hooks/useContent'
import { useExpenses } from '@/hooks/useExpenses'
import { useProfile } from '@/hooks/useProfile'
import { disposableIncome } from '@/lib/money'
import { grossForNetSars } from '@/lib/planner-math'
import { carCost, defaultCarInputs, type CarInputs } from '@/lib/tools/car-cost'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['var(--chart-2)', 'var(--chart-6)', 'var(--chart-4)', 'var(--chart-3)']

/** /tools/car — true cost of a car (§4.5). Rate defaults to prime + 2%, fuel to the published price. */
export function CarToolPage() {
  const content = useContent()
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const [region, setRegion] = useState<'inland' | 'coastal'>('inland')
  const [inputs, setInputs] = useState<CarInputs>(() => defaultCarInputs(content.prime_rate.rate, content.fuel_prices.petrol95.inland))
  const set = (k: keyof CarInputs) => (n: number) => setInputs((s) => ({ ...s, [k]: n }))
  const r = carCost(inputs)
  const disposable = profile ? disposableIncome(profile.net_income, expenses) : 0
  const afterCar = disposable - r.trueMonthly
  const grossNeeded = grossForNetSars((profile?.net_income ?? 0) + Math.max(0, -afterCar))

  return (
    <ToolShell
      tool="car"
      title="True cost of a car"
      subtitle="The instalment is only part of it. This adds the running costs and shows the balloon you’ll still owe."
      inputs={inputs}
      onLoad={setInputs}
      headline={{ label: 'True monthly cost', value: docMoney(r.trueMonthly) }}
      exportRows={[
        { section: 'Car', label: 'Price', value: docMoney(inputs.price) },
        { section: 'Car', label: 'Deposit', value: docMoney(inputs.deposit) },
        { section: 'Car', label: 'Term', value: `${inputs.termMonths} months at ${inputs.ratePct}%` },
        { section: 'Car', label: 'Balloon', value: `${inputs.balloonPct}% · ${docMoney(r.balloon)}` },
        ...r.breakdown.map((b) => ({ section: 'Every month', label: b.label, value: docMoney(b.amount) })),
        { section: 'Every month', label: 'True monthly cost', value: docMoney(r.trueMonthly), strong: true },
        { section: 'Over the term', label: 'Total paid', value: docMoney(r.totalPaid) },
        { section: 'Over the term', label: 'Interest', value: docMoney(r.totalInterest) },
      ]}
      actions={{
        plannerItems: [
          { name: 'Car instalment', amount: r.instalment, category: 'vehicle_finance', frequency: 'monthly' },
          { name: 'Car insurance', amount: inputs.insuranceMonthly, category: 'insurance', frequency: 'monthly' },
          { name: 'Fuel', amount: r.fuelMonthly, category: 'transport', frequency: 'monthly' },
          { name: 'Car upkeep', amount: inputs.servicePerYear + inputs.tyresPerYear + inputs.licenceTrackingPerYear, category: 'transport', frequency: 'annual' },
        ],
        check: { item: 'Car', amount: r.trueMonthly, recurring: true },
      }}
      form={
        <>
          <h2 className="card-title">The car</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="car-price" label="Price" value={inputs.price} onChange={set('price')} />
            <NumberField id="car-deposit" label="Deposit" value={inputs.deposit} onChange={set('deposit')} />
            <NumberField id="car-term" label="Term" suffix="months" value={inputs.termMonths} onChange={(n) => set('termMonths')(Math.min(96, Math.max(12, Math.round(n))))} step="1" />
            <NumberField id="car-rate" label="Interest rate" suffix="%" value={inputs.ratePct} onChange={set('ratePct')} hint={`Prime is ${content.prime_rate.rate}%`} />
            <NumberField id="car-balloon" label="Balloon" suffix="%" value={inputs.balloonPct} onChange={(n) => set('balloonPct')(Math.min(50, n))} />
            <NumberField id="car-insurance" label="Insurance" suffix="a month" value={inputs.insuranceMonthly} onChange={set('insuranceMonthly')} />
          </div>
          <h2 className="card-title pt-2">Running it</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="car-km" label="Kilometres" suffix="a month" value={inputs.kmPerMonth} onChange={set('kmPerMonth')} />
            <NumberField id="car-l100" label="Fuel use" suffix="l/100km" value={inputs.litresPer100km} onChange={set('litresPer100km')} />
            <div className="col-span-2">
              <span className="field-label">Fuel price</span>
              <Segmented
                full
                label="Fuel region"
                value={region}
                onChange={(v) => {
                  setRegion(v)
                  set('fuelPrice')(content.fuel_prices.petrol95[v])
                }}
                options={[
                  { value: 'inland', label: `Inland R${content.fuel_prices.petrol95.inland.toFixed(2)}` },
                  { value: 'coastal', label: `Coastal R${content.fuel_prices.petrol95.coastal.toFixed(2)}` },
                ]}
              />
            </div>
            <NumberField id="car-fuel" label="Fuel price" suffix="per litre" value={inputs.fuelPrice} onChange={set('fuelPrice')} />
            <NumberField id="car-service" label="Service" suffix="a year" value={inputs.servicePerYear} onChange={set('servicePerYear')} />
            <NumberField id="car-tyres" label="Tyres" suffix="a year" value={inputs.tyresPerYear} onChange={set('tyresPerYear')} />
            <NumberField id="car-licence" label="Licence & tracking" suffix="a year" value={inputs.licenceTrackingPerYear} onChange={set('licenceTrackingPerYear')} />
          </div>
        </>
      }
      results={
        <>
          <section className="card-elevated space-y-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[13px] text-muted-foreground">True monthly cost</p>
                <p className="tnum text-[40px] leading-none font-bold tracking-[-0.04em]">{formatCurrency(r.trueMonthly)}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] text-muted-foreground">Instalment alone</p>
                <p className="tnum text-[20px] font-bold">{formatCurrency(r.instalment)}</p>
              </div>
            </div>
            <StackedBar parts={r.breakdown.map((b, i) => ({ ...b, color: COLORS[i] }))} />
          </section>
          {r.balloon > 0 && (
            <section className="card ring-2 ring-alert/40">
              <p className="text-[15px] font-semibold text-alert">{formatCurrency(r.balloon)} still owed after month {inputs.termMonths}</p>
              <p className="mt-1 text-[13.5px] text-muted-foreground">
                A balloon lowers the instalment, but you’ll have to pay this lump sum, refinance it or trade in the car when the term ends.
              </p>
            </section>
          )}
          <section className="card">
            <ResultRow label="Total paid over the term" value={formatCurrency(r.totalPaid)} />
            <ResultRow label="Of which interest" value={formatCurrency(r.totalInterest)} tone="caution" />
            <ResultRow
              label="Left over each month after the car"
              value={formatCurrency(afterCar)}
              tone={afterCar < 0 ? 'alert' : 'positive'}
              strong
            />
            {afterCar < 0 && <ResultRow label="Salary you’d need (before tax)" value={formatCurrency(grossNeeded)} />}
          </section>
        </>
      }
    />
  )
}
