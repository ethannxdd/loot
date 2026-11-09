import { Link } from '@tanstack/react-router'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { NumberField, ResultRow } from '@/components/tools/ToolShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { StatStrip } from '@/components/ui/StatStrip'
import { useContent } from '@/hooks/useContent'
import { useAddTfsaContribution, useDeleteTfsaContribution, useRetirementProfile, useSaveRetirementProfile, useTfsaContributions } from '@/hooks/useFuture'
import { useProfile } from '@/hooks/useProfile'
import { useTaxProfile } from '@/hooks/useTaxProfile'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'
import { projectRetirement, taxYearOf, tfsaRoom, twoPotWithdrawal } from '@/lib/future'
import { dateKey } from '@/lib/sa-calendar'
import { formatCurrency } from '@/lib/utils'

type Tab = 'tfsa' | 'retirement' | 'two_pot'

/** /future (§4.7): TFSA · Retirement · Two-pot. */
export function FuturePage() {
  const [tab, setTab] = useState<Tab>('tfsa')
  return (
    <div className="animate-enter space-y-6">
      <PageHeader eyebrow="Planning" title="Future you" subtitle="Your tax-free savings room, where retirement is heading, and what a two-pot withdrawal really costs." />
      <Segmented
        label="Future you"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tfsa', label: 'TFSA' },
          { value: 'retirement', label: 'Retirement' },
          { value: 'two_pot', label: 'Two-pot' },
        ]}
      />
      {tab === 'tfsa' ? <TfsaTab /> : tab === 'retirement' ? <RetirementTab /> : <TwoPotTab />}
    </div>
  )
}

function TfsaTab() {
  const { tfsa_limits: limits } = useContent()
  const { data: contributions = [], isLoading } = useTfsaContributions()
  const add = useAddTfsaContribution()
  const remove = useDeleteTfsaContribution()
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState(dateKey(new Date()))
  const [provider, setProvider] = useState('')
  const room = tfsaRoom(contributions, limits)
  const pct = Math.min(100, room.usedPct * 100)

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0)) return toast.error('Enter an amount.')
    add.mutate(
      { amount: n, contributed_on: day, tax_year: taxYearOf(new Date(`${day}T00:00:00`)), provider: provider.trim() || null },
      {
        onSuccess: () => {
          setAmount('')
          toast.success('Contribution logged')
        },
      },
    )
  }

  if (isLoading) return <div className="skeleton h-64 rounded-2xl" />
  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: `Room in ${room.taxYear}`, value: formatCurrency(room.roomThisYear), valueColor: room.warning === 'over' ? 'var(--alert)' : undefined },
          { label: 'Paid in this year', value: formatCurrency(room.thisYear), sub: `of ${formatCurrency(room.annualLimit)}` },
          { label: 'Lifetime', value: formatCurrency(room.lifetime), sub: `of ${formatCurrency(room.lifetimeLimit)}` },
          { label: 'To max it by 28 Feb', value: room.monthlyToMax > 0 ? formatCurrency(room.monthlyToMax) : '—', sub: room.monthlyToMax > 0 ? 'a month' : undefined },
        ]}
      />
      <section className="card space-y-3">
        <div className="budget-track !h-3">
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: room.warning === 'none' ? 'var(--accent)' : room.warning === 'eighty' ? 'var(--caution)' : 'var(--alert)' }} />
        </div>
        {room.warning === 'eighty' && (
          <p className="text-[14px] text-caution">{formatCurrency(room.roomThisYear)} room left this tax year — over this is taxed {limits.penalty_pct}%.</p>
        )}
        {room.warning === 'full' && <p className="text-[14px] text-alert">You’ve used this year’s {formatCurrency(room.annualLimit)}. Anything more is taxed {limits.penalty_pct}%.</p>}
        {room.warning === 'over' && (
          <p className="text-[14px] text-alert">
            You’re {formatCurrency(room.thisYear - room.annualLimit)} over the limit — SARS charges {limits.penalty_pct}%, about {formatCurrency(room.penalty)}.
          </p>
        )}
      </section>
      <form onSubmit={submit} className="card grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
        <div>
          <label className="field-label" htmlFor="tfsa-amount">
            Contribution
          </label>
          <input id="tfsa-amount" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="tfsa-date">
            Date
          </label>
          <input id="tfsa-date" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="tfsa-provider">
            Provider
          </label>
          <input id="tfsa-provider" value={provider} maxLength={80} onChange={(e) => setProvider(e.target.value)} placeholder="EasyEquities" />
        </div>
        <button type="submit" disabled={add.isPending} className="btn btn-primary">
          {add.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Log it
        </button>
      </form>
      {contributions.length > 0 && (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
          {contributions.map((c, i) => (
            <li key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
              <div>
                <p className="tnum text-[15px] font-semibold">{formatCurrency(c.amount)}</p>
                <p className="text-[12.5px] text-muted-foreground">
                  {new Date(`${c.contributed_on}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} · {c.tax_year}
                  {c.provider ? ` · ${c.provider}` : ''}
                </p>
              </div>
              <button type="button" aria-label="Delete contribution" onClick={() => remove.mutate(c.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-fill hover:text-alert">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RetirementTab() {
  const { data: saved, isLoading } = useRetirementProfile()
  const save = useSaveRetirementProfile()
  const content = useContent()
  const { data: taxProfile } = useTaxProfile()
  const [f, setF] = useState({ currentAge: 30, retirementAge: 65, balance: 0, monthly: 0, employer: 0, realReturn: content.retirement_real_return_pct, desired: 20_000 })
  useEffect(() => {
    if (!saved && !taxProfile) return
    setF((s) => ({
      ...s,
      currentAge: saved?.current_age ?? taxProfile?.age ?? s.currentAge,
      retirementAge: saved?.retirement_age ?? s.retirementAge,
      balance: saved ? saved.ra_balance + saved.pension_balance : s.balance,
      monthly: saved?.monthly_contribution ?? s.monthly,
      employer: saved?.employer_contribution ?? s.employer,
      realReturn: saved?.real_return_pct ?? s.realReturn,
      desired: saved?.desired_income ?? s.desired,
    }))
  }, [saved, taxProfile])
  const r = projectRetirement({
    currentAge: f.currentAge,
    retirementAge: f.retirementAge,
    balance: f.balance,
    monthlyContribution: f.monthly + f.employer,
    realReturnPct: f.realReturn,
    desiredIncome: f.desired,
  })

  if (isLoading) return <div className="skeleton h-64 rounded-2xl" />
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <section className="card space-y-3 lg:col-span-5">
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="ret-age" label="Your age" value={f.currentAge} onChange={(n) => setF((s) => ({ ...s, currentAge: n }))} step="1" />
          <NumberField id="ret-retire" label="Retire at" value={f.retirementAge} onChange={(n) => setF((s) => ({ ...s, retirementAge: n }))} step="1" />
          <div className="col-span-2">
            <NumberField id="ret-bal" label="RA, pension & provident today" value={f.balance} onChange={(n) => setF((s) => ({ ...s, balance: n }))} />
          </div>
          <NumberField id="ret-mine" label="You put in" suffix="a month" value={f.monthly} onChange={(n) => setF((s) => ({ ...s, monthly: n }))} />
          <NumberField id="ret-emp" label="Employer puts in" suffix="a month" value={f.employer} onChange={(n) => setF((s) => ({ ...s, employer: n }))} />
          <NumberField id="ret-return" label="Growth after inflation" suffix="% a year" value={f.realReturn} onChange={(n) => setF((s) => ({ ...s, realReturn: n }))} />
          <NumberField id="ret-want" label="Income you want" suffix="a month, today’s rands" value={f.desired} onChange={(n) => setF((s) => ({ ...s, desired: n }))} />
        </div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(
              {
                current_age: f.currentAge,
                retirement_age: Math.min(80, Math.max(40, f.retirementAge)),
                ra_balance: f.balance,
                pension_balance: 0,
                monthly_contribution: f.monthly,
                employer_contribution: f.employer,
                real_return_pct: f.realReturn,
                desired_income: f.desired,
              },
              { onSuccess: () => toast.success('Saved') },
            )
          }
          className="btn btn-primary w-full"
        >
          Save my numbers
        </button>
      </section>
      <div className="space-y-4 lg:col-span-7">
        <section className="card-elevated space-y-1 sm:p-6">
          <p className="text-[13px] text-muted-foreground">On track for</p>
          <p className="tnum text-[40px] leading-none font-bold tracking-[-0.04em]">{formatCurrency(r.monthlyIncome)}<span className="text-[18px] text-muted-foreground"> a month</span></p>
          <p className={`pt-1 text-[14px] ${r.onTrack ? 'text-primary' : 'text-caution'}`}>
            {r.onTrack ? 'That covers the income you want.' : `${formatCurrency(r.gap)} a month short of what you want.`}
          </p>
        </section>
        <section className="card">
          <ResultRow label="Projected pot at retirement (today’s rands)" value={formatCurrency(r.pot)} />
          <ResultRow label="An extra R500 a month adds" value={`${formatCurrency(r.plus500)} a month`} tone="positive" />
          <p className="pt-2 text-[12.5px] text-muted-foreground">
            Uses a 4% a year drawdown. RA contributions also cut your tax — see the{' '}
            <Link to="/tax" className="font-semibold text-primary">
              Tax centre
            </Link>
            .
          </p>
        </section>
        {r.series.length > 1 && (
          <section className="card">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--hairline)" vertical={false} />
                  <XAxis dataKey="age" tick={chartAxisTick} tickLine={false} axisLine={false} />
                  <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => `R${Math.round(Number(v) / 1_000_000)}m`} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => formatCurrency(Number(v))} labelFormatter={(a) => `Age ${a}`} />
                  <Area type="monotone" dataKey="pot" name="Retirement savings" stroke="var(--chart-1)" fill="var(--accent-tint)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function TwoPotTab() {
  const content = useContent()
  const { data: profile } = useProfile()
  const { data: taxProfile } = useTaxProfile()
  const { data: saved } = useRetirementProfile()
  const save = useSaveRetirementProfile()
  const [balance, setBalance] = useState<number | null>(null)
  const [withdrawal, setWithdrawal] = useState(10_000)
  const [fee, setFee] = useState(300)
  const age = saved?.current_age ?? taxProfile?.age ?? 35
  const pot = balance ?? saved?.savings_pot_balance ?? 0
  const r = twoPotWithdrawal({
    balance: pot,
    withdrawal,
    adminFee: fee,
    annualIncome: (profile?.gross_income ?? 0) * 12,
    age,
    realReturnPct: saved?.real_return_pct ?? content.retirement_real_return_pct,
    yearsToRetirement: (saved?.retirement_age ?? 65) - age,
  }, content.two_pot)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <section className="card space-y-3 lg:col-span-5">
        <NumberField id="tp-bal" label="Savings pot balance" value={pot} onChange={setBalance} hint="On your fund’s statement or app as the savings component." />
        <NumberField id="tp-w" label="Amount to take out" value={withdrawal} onChange={setWithdrawal} hint={`Minimum R${content.two_pot.min_withdrawal.toLocaleString('en-ZA')}. Once per tax year.`} />
        <NumberField id="tp-fee" label="Fund admin fee" value={fee} onChange={setFee} />
        {balance !== null && (
          <button type="button" onClick={() => save.mutate({ savings_pot_balance: pot }, { onSuccess: () => toast.success('Balance saved') })} className="btn btn-secondary">
            Remember this balance
          </button>
        )}
      </section>
      <div className="space-y-4 lg:col-span-7">
        <section className="card-elevated space-y-1 sm:p-6">
          <p className="text-[13px] text-muted-foreground">You’d actually get</p>
          <p className="tnum text-[40px] leading-none font-bold tracking-[-0.04em]">{formatCurrency(r.net)}</p>
          {!r.allowed && <p className="pt-1 text-[14px] text-alert">{r.reason}</p>}
        </section>
        <section className="card">
          <ResultRow label={`Tax at your ${r.marginalRatePct}% marginal rate`} value={formatCurrency(r.tax)} tone="caution" />
          <ResultRow label="Admin fee" value={formatCurrency(fee)} />
          <ResultRow label="What it would have grown to by retirement" value={formatCurrency(r.costAtRetirement)} tone="alert" strong />
          <p className="pt-2 text-[12.5px] text-muted-foreground">
            Once per tax year. Taxed at your marginal rate, using your income in Settings. Your fund’s tax directive is the final word.
          </p>
        </section>
      </div>
    </div>
  )
}
