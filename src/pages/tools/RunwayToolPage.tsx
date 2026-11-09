import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { docMoney } from '@/components/export/ExportDocs'
import { NumberField, ResultRow, ToolShell } from '@/components/tools/ToolShell'
import { Segmented } from '@/components/ui/Segmented'
import { SwitchRow } from '@/components/ui/Switch'
import { useExpenses } from '@/hooks/useExpenses'
import { useGoals } from '@/hooks/useGoals'
import { useNetWorthItems } from '@/hooks/useNetWorthItems'
import { useProfile } from '@/hooks/useProfile'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'
import { monthlyEquivalent } from '@/lib/money'
import { NEW_BABY_MONTHLY, runway, RUNWAY_SCENARIO_LABELS, type RunwayInputs, type RunwayScenario } from '@/lib/tools/runway'
import { formatCurrency } from '@/lib/utils'

/** Categories treated as essential by default (the rest can be cut). */
const ESSENTIAL = new Set(['housing', 'transport', 'vehicle_finance', 'insurance', 'medical_aid', 'debt_repayments', 'groceries', 'childcare', 'education', 'phone_airtime', 'household'])

/** /tools/runway (§4.5): how long savings last. Savings prefill from net worth cash + the emergency fund goal. */
export function RunwayToolPage() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: goals = [] } = useGoals()
  const { data: worth = [] } = useNetWorthItems()
  const active = expenses.filter((e) => !e.deleted_at && monthlyEquivalent(e) > 0 && !['savings', 'investments'].includes(e.category))
  const [cutIds, setCutIds] = useState<Set<string> | null>(null)
  const cuttable = cutIds ?? new Set(active.filter((e) => !ESSENTIAL.has(e.category)).map((e) => e.id))

  const prefillSavings = useMemo(
    () =>
      worth.filter((w) => w.kind === 'asset' && w.category === 'cash').reduce((s, w) => s + Number(w.value), 0) +
      (goals.find((g) => g.category === 'emergency_fund')?.current_amount ?? 0),
    [worth, goals],
  )
  const [inputs, setInputs] = useState<Omit<RunwayInputs, 'essentials' | 'cuttable' | 'takeHome'> & { savingsOverride: number | null }>({
    savings: 0,
    savingsOverride: null,
    scenario: 'lose_income',
    payCutPct: 20,
    extraMonthly: NEW_BABY_MONTHLY,
    otherIncome: 0,
    cut: false,
  })
  const savings = inputs.savingsOverride ?? prefillSavings
  const essentials = active.filter((e) => !cuttable.has(e.id)).reduce((s, e) => s + monthlyEquivalent(e), 0)
  const cuttableTotal = active.filter((e) => cuttable.has(e.id)).reduce((s, e) => s + monthlyEquivalent(e), 0)
  const r = runway({ ...inputs, savings, takeHome: profile?.net_income ?? 0, essentials, cuttable: cuttableTotal })
  const cutNames = active.filter((e) => cuttable.has(e.id)).map((e) => e.name)
  const monthsText = r.months === null ? 'Your savings don’t run out' : `${Math.floor(r.months)} month${Math.floor(r.months) === 1 ? '' : 's'}`

  return (
    <ToolShell
      tool="runway"
      title="Runway / What if"
      subtitle="How long your savings would carry you if your income stopped, shrank or your costs jumped."
      inputs={{ ...inputs, savingsOverride: savings }}
      onLoad={(i) => setInputs(i)}
      headline={{ label: 'Runway', value: monthsText, tone: r.months !== null && r.months < 3 ? 'alert' : 'positive' }}
      exportRows={[
        { section: 'Scenario', label: RUNWAY_SCENARIO_LABELS[inputs.scenario], value: '' },
        { section: 'Scenario', label: 'Savings you can use', value: docMoney(savings) },
        { section: 'Scenario', label: 'Essential costs', value: docMoney(essentials) },
        { section: 'Scenario', label: inputs.cut ? 'Cuttable costs (cut)' : 'Cuttable costs', value: docMoney(cuttableTotal) },
        { section: 'Result', label: 'Monthly shortfall', value: docMoney(Math.max(0, r.shortfall)) },
        { section: 'Result', label: 'Runway', value: monthsText, strong: true },
        ...(r.runsOutOn ? [{ section: 'Result', label: 'Money runs out around', value: r.runsOutOn.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) }] : []),
      ]}
      form={
        <>
          <div>
            <span className="field-label">What if</span>
            <div className="overflow-x-auto [&_button]:whitespace-nowrap">
              <Segmented label="Scenario" value={inputs.scenario} onChange={(v: RunwayScenario) => setInputs((s) => ({ ...s, scenario: v }))} options={(Object.keys(RUNWAY_SCENARIO_LABELS) as RunwayScenario[]).map((k) => ({ value: k, label: RUNWAY_SCENARIO_LABELS[k] }))} />
            </div>
          </div>
          <NumberField id="rw-savings" label="Savings you could use" value={savings} onChange={(n) => setInputs((s) => ({ ...s, savingsOverride: n }))} hint="From your cash assets and emergency fund. Change it if you have more or less." />
          {inputs.scenario === 'lose_income' && <NumberField id="rw-uif" label="UIF or other income" suffix="a month" value={inputs.otherIncome} onChange={(n) => setInputs((s) => ({ ...s, otherIncome: n }))} />}
          {inputs.scenario === 'pay_cut' && <NumberField id="rw-cut" label="Pay cut" suffix="%" value={inputs.payCutPct} onChange={(n) => setInputs((s) => ({ ...s, payCutPct: Math.min(100, n) }))} />}
          {(inputs.scenario === 'new_baby' || inputs.scenario === 'custom') && (
            <NumberField id="rw-extra" label={inputs.scenario === 'new_baby' ? 'Baby costs' : 'Extra costs'} suffix="a month" value={inputs.extraMonthly} onChange={(n) => setInputs((s) => ({ ...s, extraMonthly: n }))} />
          )}
          <SwitchRow checked={inputs.cut} onChange={(cut) => setInputs((s) => ({ ...s, cut }))} label="Cut the cuttable costs" hint="Tick what you’d stop paying below." />
          <ul className="max-h-72 divide-y divide-hairline overflow-y-auto rounded-2xl bg-fill">
            {active.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <input
                  type="checkbox"
                  id={`cut-${e.id}`}
                  checked={cuttable.has(e.id)}
                  onChange={(ev) => {
                    const next = new Set(cuttable)
                    if (ev.target.checked) next.add(e.id)
                    else next.delete(e.id)
                    setCutIds(next)
                  }}
                />
                <label htmlFor={`cut-${e.id}`} className="flex-1 truncate text-[14px]">
                  {e.name}
                </label>
                <span className="tnum text-[13.5px] text-muted-foreground">{formatCurrency(monthlyEquivalent(e))}</span>
              </li>
            ))}
            {active.length === 0 && <li className="px-3.5 py-3 text-[13px] text-muted-foreground">Add your expenses to see your runway.</li>}
          </ul>
        </>
      }
      results={
        <>
          <section className="card-elevated space-y-1 sm:p-6">
            <p className="text-[13px] text-muted-foreground">Your savings last</p>
            <p className={`tnum text-[40px] leading-none font-bold tracking-[-0.04em] ${r.months !== null && r.months < 3 ? 'text-alert' : ''}`}>{monthsText}</p>
            {r.runsOutOn && <p className="pt-1 text-[14px] text-muted-foreground">Money runs out around {r.runsOutOn.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            {!inputs.cut && r.cutGain !== 0 && cutNames.length > 0 && (
              <p className="pt-2 text-[14px]">
                Cutting {cutNames.slice(0, 3).join(', ')}
                {cutNames.length > 3 ? ` and ${cutNames.length - 3} more` : ''}{' '}
                {r.cutGain === null ? 'means your savings never run out.' : `buys you ${r.cutGain.toFixed(1)} more month${r.cutGain === 1 ? '' : 's'}.`}
              </p>
            )}
          </section>
          <section className="card">
            <ResultRow label="Spending a month" value={formatCurrency(essentials + (inputs.cut ? 0 : cuttableTotal))} />
            <ResultRow label="Short each month" value={formatCurrency(Math.max(0, r.shortfall))} tone={r.shortfall > 0 ? 'alert' : 'positive'} strong />
          </section>
          {r.series.length > 1 && (
            <section className="card">
              <h3 className="card-title mb-3">Savings month by month</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={r.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--hairline)" vertical={false} />
                    <XAxis dataKey="month" tick={chartAxisTick} tickLine={false} axisLine={false} tickFormatter={(m) => `M${m}`} />
                    <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => `R${Math.round(Number(v) / 1000)}k`} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => formatCurrency(Number(v))} labelFormatter={(m) => `Month ${m}`} />
                    <Area type="monotone" dataKey="balance" name="Savings" stroke="var(--chart-1)" fill="var(--accent-tint)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </>
      }
    />
  )
}
