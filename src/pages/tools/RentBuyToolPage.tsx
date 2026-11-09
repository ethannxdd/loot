import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { docMoney } from '@/components/export/ExportDocs'
import { NumberField, ResultRow, ToolShell } from '@/components/tools/ToolShell'
import { Segmented } from '@/components/ui/Segmented'
import { useContent } from '@/hooks/useContent'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'
import { defaultRentBuyInputs, rentVsBuy, type RentBuyInputs } from '@/lib/tools/rent-vs-buy'
import { formatCurrency } from '@/lib/utils'

/** /tools/rent-vs-buy (§4.5). Transfer duty and bond/transfer cost estimates come from content (SARS table). */
export function RentBuyToolPage() {
  const content = useContent()
  const [inputs, setInputs] = useState<RentBuyInputs>(() => defaultRentBuyInputs(content.prime_rate.rate))
  const set = (k: keyof RentBuyInputs) => (n: number) => setInputs((s) => ({ ...s, [k]: n }))
  const r = rentVsBuy(inputs, content.transfer_duty.brackets, content.bond_costs)
  const verdict =
    r.breakEvenYear === null
      ? `Over ${inputs.years} years, renting comes out cheaper with these numbers.`
      : `Buying pulls ahead in year ${r.breakEvenYear}. Stay shorter than that and renting is cheaper.`

  return (
    <ToolShell
      tool="rent_vs_buy"
      title="Rent vs buy"
      subtitle="Compares what each really costs you over time — buying counts the equity you build; renting counts what your deposit could earn invested."
      inputs={inputs}
      onLoad={setInputs}
      headline={{ label: 'Break-even', value: r.breakEvenYear ? `Year ${r.breakEvenYear}` : 'Not within the period' }}
      exportRows={[
        { section: 'Buying', label: 'Price', value: docMoney(inputs.price) },
        { section: 'Buying', label: 'Deposit', value: docMoney(inputs.deposit) },
        { section: 'Buying', label: 'Transfer duty (SARS)', value: docMoney(r.duty) },
        { section: 'Buying', label: 'Transfer and bond costs (estimate)', value: docMoney(r.transferCosts + r.bondCosts) },
        { section: 'Buying', label: 'Cash needed upfront', value: docMoney(r.upfront), strong: true },
        { section: 'Every month', label: 'Bond repayment', value: docMoney(r.bondRepayment) },
        { section: 'Every month', label: 'Owning (all-in, year 1)', value: docMoney(r.buyMonthly) },
        { section: 'Every month', label: 'Renting (year 1)', value: docMoney(r.rentMonthly) },
        { section: 'Verdict', label: verdict, value: '' },
      ]}
      actions={{
        plannerItems: [
          { name: 'Bond repayment', amount: r.bondRepayment, category: 'housing', frequency: 'monthly' },
          { name: 'Rates & levies', amount: inputs.ratesLeviesMonthly, category: 'housing', frequency: 'monthly' },
          { name: 'Home insurance', amount: inputs.insuranceMonthly, category: 'insurance', frequency: 'monthly' },
        ],
        check: { item: 'Buying a home (monthly)', amount: r.buyMonthly, recurring: true },
      }}
      form={
        <>
          <h2 className="card-title">Buying</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="rb-price" label="Price" value={inputs.price} onChange={set('price')} />
            <NumberField id="rb-deposit" label="Deposit" value={inputs.deposit} onChange={set('deposit')} />
            <NumberField id="rb-rate" label="Bond rate" suffix="%" value={inputs.bondRatePct} onChange={set('bondRatePct')} hint={`Prime is ${content.prime_rate.rate}%`} />
            <div>
              <span className="field-label">Term</span>
              <Segmented full label="Bond term" value={String(inputs.termYears)} onChange={(v) => setInputs((s) => ({ ...s, termYears: Number(v) as 20 | 30 }))} options={[{ value: '20', label: '20 years' }, { value: '30', label: '30 years' }]} />
            </div>
            <NumberField id="rb-rates" label="Rates & levies" suffix="a month" value={inputs.ratesLeviesMonthly} onChange={set('ratesLeviesMonthly')} />
            <NumberField id="rb-ins" label="Insurance" suffix="a month" value={inputs.insuranceMonthly} onChange={set('insuranceMonthly')} />
            <NumberField id="rb-maint" label="Maintenance" suffix="% a year" value={inputs.maintenancePctYear} onChange={set('maintenancePctYear')} />
            <NumberField id="rb-growth" label="Property growth" suffix="% a year" value={inputs.propertyGrowthPct} onChange={set('propertyGrowthPct')} />
          </div>
          <h2 className="card-title pt-2">Renting</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="rb-rent" label="Rent" suffix="a month" value={inputs.rentMonthly} onChange={set('rentMonthly')} />
            <NumberField id="rb-esc" label="Rent increase" suffix="% a year" value={inputs.rentEscalationPct} onChange={set('rentEscalationPct')} />
            <NumberField id="rb-return" label="Invested deposit earns" suffix="% a year" value={inputs.investReturnPct} onChange={set('investReturnPct')} />
            <NumberField id="rb-years" label="Compare over" suffix="years" value={inputs.years} onChange={(n) => set('years')(Math.min(30, Math.max(1, Math.round(n))))} step="1" />
          </div>
        </>
      }
      results={
        <>
          <section className="card-elevated space-y-1 sm:p-6">
            <p className="text-[13px] text-muted-foreground">Cash you need upfront to buy</p>
            <p className="tnum text-[40px] leading-none font-bold tracking-[-0.04em]">{formatCurrency(r.upfront)}</p>
            <p className="pt-2 text-[14px]">{verdict}</p>
          </section>
          <section className="card">
            <ResultRow label="Transfer duty (SARS table)" value={formatCurrency(r.duty)} />
            <ResultRow label="Transfer and bond costs (estimate)" value={formatCurrency(r.transferCosts + r.bondCosts)} />
            <ResultRow label="Bond repayment" value={formatCurrency(r.bondRepayment)} />
            <ResultRow label="Owning, all-in (year 1)" value={formatCurrency(r.buyMonthly)} strong />
            <ResultRow label="Renting (year 1)" value={formatCurrency(r.rentMonthly)} strong />
          </section>
          <section className="card">
            <h3 className="card-title mb-3">Net cost over time</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={r.years} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--hairline)" vertical={false} />
                  <XAxis dataKey="year" tick={chartAxisTick} tickLine={false} axisLine={false} tickFormatter={(y) => `Y${y}`} />
                  <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => `R${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => formatCurrency(Number(v))} labelFormatter={(y) => `Year ${y}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="buyNet" name="Buying (net of equity)" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="rentNet" name="Renting (net of returns)" stroke="var(--chart-4)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      }
    />
  )
}
