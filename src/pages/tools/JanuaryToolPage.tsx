import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { docMoney } from '@/components/export/ExportDocs'
import { NumberField, ResultRow, StackedBar, ToolShell } from '@/components/tools/ToolShell'
import { Segmented } from '@/components/ui/Segmented'
import { useLiveCycle } from '@/hooks/useCycle'
import { useExpenses } from '@/hooks/useExpenses'
import { useCreateGoal } from '@/hooks/useGoals'
import { useProfile } from '@/hooks/useProfile'
import { adjustedPayday } from '@/lib/cycle'
import { totalMonthlyExpenses } from '@/lib/money'
import { dateKey } from '@/lib/sa-calendar'
import { surviveJanuary, type JanuaryInputs } from '@/lib/tools/january'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['var(--chart-2)', 'var(--chart-5)', 'var(--chart-4)', 'var(--chart-1)']

function seasonYear(today = new Date()) {
  // Nov–Dec plans this coming January; Jan plans the current one.
  return today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
}

/** /tools/january (§3.5): make December pay last to January payday. Paydays prefill from the payday rule. */
export function JanuaryToolPage() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { settings } = useLiveCycle()
  const createGoal = useCreateGoal()
  const y = seasonYear()
  const decDefault = settings ? adjustedPayday(y, 11, settings) : new Date(y, 11, 24)
  const janDefault = settings ? adjustedPayday(y + 1, 0, settings) : new Date(y + 1, 0, 25)
  const [early, setEarly] = useState<'usual' | 'early'>('early')
  const [inputs, setInputs] = useState<JanuaryInputs>(() => ({
    decPayday: dateKey(decDefault ?? new Date(y, 11, 24)),
    janPayday: dateKey(janDefault ?? new Date(y + 1, 0, 25)),
    decPay: profile?.net_income ?? 0,
    commitments: Math.round(totalMonthlyExpenses(expenses)),
    festive: { gifts: 2_000, travel: 1_500, food: 2_000, other: 0 },
    school: [
      { label: 'Fees', amount: 0 },
      { label: 'Uniforms', amount: 1_500 },
      { label: 'Stationery', amount: 800 },
    ],
    usualDays: 31,
  }))
  // Fill pay and commitments once they load (without overwriting what the person typed).
  const decPay = inputs.decPay || profile?.net_income || 0
  const commitments = inputs.commitments || Math.round(totalMonthlyExpenses(expenses))
  const r = surviveJanuary({ ...inputs, decPay, commitments })
  const setF = (k: keyof JanuaryInputs['festive']) => (n: number) => setInputs((s) => ({ ...s, festive: { ...s.festive, [k]: n } }))

  return (
    <ToolShell
      tool="january"
      title="Survive January"
      subtitle="December pay often comes early and has to stretch to January payday — with the festive season and back-to-school on top."
      inputs={{ ...inputs, decPay, commitments }}
      onLoad={setInputs}
      headline={{ label: 'Set aside from December pay', value: docMoney(r.setAside) }}
      exportRows={[
        { section: 'The stretch', label: 'December payday', value: inputs.decPayday },
        { section: 'The stretch', label: 'January payday', value: inputs.janPayday },
        { section: 'The stretch', label: 'December pay has to last', value: `${r.stretchDays} days (${r.extraDays >= 0 ? '+' : ''}${r.extraDays} vs usual)` },
        ...r.breakdown.map((b) => ({ section: 'Where December pay goes', label: b.label, value: docMoney(b.amount) })),
        { section: 'Plan', label: 'Day-to-day allowance', value: `${docMoney(r.dailyAllowance)} a day` },
        { section: 'Plan', label: 'Set aside for January', value: docMoney(r.setAside), strong: true },
      ]}
      form={
        <>
          <h2 className="card-title">Paydays</h2>
          <div>
            <span className="field-label">December pay</span>
            <Segmented
              full
              label="December pay"
              value={early}
              onChange={(v) => {
                setEarly(v)
                if (v === 'usual' && settings) setInputs((s) => ({ ...s, decPayday: dateKey(adjustedPayday(y, 11, settings)!) }))
              }}
              options={[
                { value: 'usual', label: 'Same as usual' },
                { value: 'early', label: 'Paid early' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="jan-dec">
                December payday
              </label>
              <input id="jan-dec" type="date" value={inputs.decPayday} onChange={(e) => setInputs((s) => ({ ...s, decPayday: e.target.value }))} />
            </div>
            <div>
              <label className="field-label" htmlFor="jan-jan">
                January payday
              </label>
              <input id="jan-jan" type="date" value={inputs.janPayday} onChange={(e) => setInputs((s) => ({ ...s, janPayday: e.target.value }))} />
            </div>
            <NumberField id="jan-pay" label="December take-home" value={decPay} onChange={(n) => setInputs((s) => ({ ...s, decPay: n }))} />
            <NumberField id="jan-commit" label="Debit orders & bills" value={commitments} onChange={(n) => setInputs((s) => ({ ...s, commitments: n }))} hint="From your expenses" />
          </div>
          <h2 className="card-title pt-2">Festive season</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="jan-gifts" label="Gifts" value={inputs.festive.gifts} onChange={setF('gifts')} />
            <NumberField id="jan-travel" label="Travel" value={inputs.festive.travel} onChange={setF('travel')} />
            <NumberField id="jan-food" label="Food & parties" value={inputs.festive.food} onChange={setF('food')} />
            <NumberField id="jan-other" label="Other" value={inputs.festive.other} onChange={setF('other')} />
          </div>
          <h2 className="card-title pt-2">Back to school</h2>
          <ul className="space-y-2">
            {inputs.school.map((row, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  aria-label="Item"
                  value={row.label}
                  onChange={(e) => setInputs((s) => ({ ...s, school: s.school.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))}
                />
                <input
                  aria-label={`${row.label} amount`}
                  className="!w-32"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={row.amount || ''}
                  onChange={(e) => setInputs((s) => ({ ...s, school: s.school.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)) }))}
                />
                <button type="button" aria-label={`Remove ${row.label}`} onClick={() => setInputs((s) => ({ ...s, school: s.school.filter((_, j) => j !== i) }))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-fill">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setInputs((s) => ({ ...s, school: [...s.school, { label: 'Transport', amount: 0 }] }))} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
            <Plus size={14} /> Add a row
          </button>
        </>
      }
      results={
        <>
          <section className="card-elevated space-y-2 sm:p-6">
            <p className="text-[13px] text-muted-foreground">December pay has to last</p>
            <p className="tnum text-[40px] leading-none font-bold tracking-[-0.04em]">{r.stretchDays} days</p>
            <p className="text-[14px] text-muted-foreground">{r.extraDays > 0 ? `${r.extraDays} days longer than usual.` : 'About the same as a usual month.'}</p>
            <StackedBar parts={r.breakdown.map((b, i) => ({ ...b, color: COLORS[i] }))} />
          </section>
          <section className="card">
            <ResultRow label="Day-to-day allowance" value={`${formatCurrency(r.dailyAllowance)} a day`} tone={r.dayToDay < 0 ? 'alert' : undefined} />
            <ResultRow label={`Set aside for January (${r.januaryDays} days + school)`} value={formatCurrency(r.setAside)} strong tone="positive" />
            {r.dayToDay < 0 && <ResultRow label="Short before day-to-day spending" value={formatCurrency(-r.dayToDay)} tone="alert" />}
          </section>
          <div className="card flex flex-wrap gap-2">
            <button
              type="button"
              disabled={createGoal.isPending || r.setAside <= 0}
              onClick={() =>
                createGoal.mutate(
                  { name: `January ${y + 1}`, category: 'other', target_amount: r.setAside, target_date: inputs.decPayday },
                  { onSuccess: () => toast.success('“January” goal created. Put the money in on December payday.') },
                )
              }
              className="btn btn-primary"
            >
              Create a “January” goal
            </button>
          </div>
        </>
      }
    />
  )
}
