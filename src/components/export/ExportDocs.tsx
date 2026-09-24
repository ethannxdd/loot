/**
 * Purpose-built export documents (PNG/PDF). They are never shown on screen — `exportDocument` in
 * lib/export.ts renders them off-screen at a fixed 820px width and snapshots them.
 *
 * Rules that keep html2canvas output identical to the browser:
 * - no `truncate`/overflow-hidden on text and line-height ≥ 1.2 (tight leading clips glyph tops);
 * - money goes through `docMoney`, which swaps the non-breaking group separators Intl emits for plain
 *   spaces (html2canvas measures NBSP wider, which split "R 10 456" into "R 10  456");
 * - no letter-spacing (see `.export-snapshot`).
 */
import type { ReactNode } from 'react'
import { categoryColor, categoryLabel } from '@/lib/categories'
import { monthLabel } from '@/lib/money'
import { computePhase } from '@/lib/planner-math'
import { computePlanTotals, METRIC_LOWER_IS_BETTER, winningPlanIds, type CompareMetric } from '@/lib/plan-compare'
import type { MonthlySnapshot, PlannerPlan } from '@/lib/types'
import { getActiveCurrency } from '@/lib/utils'

const moneyFormatters = new Map<string, Intl.NumberFormat>()

/** "R 14 305,00" style money with cents and plain-space grouping — safe for html2canvas. */
export function docMoney(amount: number, currency = getActiveCurrency()) {
  if (!Number.isFinite(amount)) return '—'
  let f = moneyFormatters.get(currency)
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-ZA', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } catch {
      f = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    moneyFormatters.set(currency, f)
  }
  return f.format(Math.abs(amount) < 0.005 ? 0 : amount).replace(/[\u00A0\u202F]/g, ' ')
}

const today = () => new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

/* ---------- primitives ---------- */

function Mark() {
  return <img src="/icons/app-icon.svg" width={22} height={22} alt="" style={{ width: 22, height: 22, borderRadius: 6 }} />
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-[1.4] font-semibold text-muted-foreground uppercase">{children}</p>
}

function Doc({
  kind,
  title,
  meta,
  headline,
  children,
  disclaimer,
}: {
  kind: string
  title: string
  meta: string
  headline?: { label: string; value: string; sub?: string; tone?: 'positive' | 'alert' }
  children: ReactNode
  disclaimer: string
}) {
  return (
    <div className="w-[820px] bg-background px-14 py-12 text-foreground" style={{ lineHeight: 1.35 }}>
      <header className="flex items-start justify-between gap-8 border-b border-hairline pb-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Mark />
            <Eyebrow>Loot · {kind}</Eyebrow>
          </div>
          <h1 className="mt-4 text-[34px] leading-[1.15] font-bold break-words">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-[1.4] text-muted-foreground">{meta}</p>
        </div>
        {headline && (
          <div className="shrink-0 text-right">
            <Eyebrow>{headline.label}</Eyebrow>
            <p
              className={`tnum mt-2 text-[32px] leading-[1.2] font-bold ${
                headline.tone === 'alert' ? 'text-alert' : headline.tone === 'positive' ? 'text-primary' : ''
              }`}
            >
              {headline.value}
            </p>
            {headline.sub && <p className="tnum mt-1 text-[12.5px] leading-[1.4] text-muted-foreground">{headline.sub}</p>}
          </div>
        )}
      </header>
      <div className="mt-7 space-y-5">{children}</div>
      <footer className="mt-9 flex items-start justify-between gap-8 border-t border-hairline pt-5 text-[11.5px] leading-[1.45] text-text-subtle">
        <span className="shrink-0">Loot · {kind} · {today()}</span>
        <span className="text-right">{disclaimer}</span>
      </footer>
    </div>
  )
}

function StatCards({ items }: { items: { label: string; value: string; sub?: string; tone?: 'positive' | 'alert' }[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((s) => (
        <div key={s.label} className="card !p-5">
          <Eyebrow>{s.label}</Eyebrow>
          <p className={`tnum mt-2.5 text-[21px] leading-[1.25] font-bold ${s.tone === 'alert' ? 'text-alert' : s.tone === 'positive' ? 'text-primary' : ''}`}>
            {s.value}
          </p>
          {s.sub && <p className="mt-1 text-[12px] leading-[1.4] text-muted-foreground">{s.sub}</p>}
        </div>
      ))}
    </div>
  )
}

function Dot({ color }: { color: string }) {
  // A glyph rather than an inline-block box: html2canvas shifts text next to inline-blocks off the baseline.
  return <span style={{ color, marginRight: 6 }}>●</span>
}

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={`pb-2.5 text-[11px] leading-[1.4] font-semibold text-muted-foreground uppercase ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}

function Notes({ text }: { text: string }) {
  return (
    <section className="card !p-5">
      <Eyebrow>Notes</Eyebrow>
      <p className="mt-2 text-[14px] leading-[1.55] whitespace-pre-wrap">{text}</p>
    </section>
  )
}

/* ---------- Salary plan ---------- */

export function PlanExportDoc({ plan }: { plan: PlannerPlan }) {
  const totals = computePlanTotals(plan)
  const phases = plan.phases.map((p) => ({ phase: p, c: computePhase(p, plan.tax_rate_pct) }))
  const multi = phases.length > 1
  const per = (n: number) => (multi ? n / phases.length : n)
  const avgNote = multi ? `Average across ${phases.length} phases` : undefined

  return (
    <Doc
      kind="Salary planner"
      title={plan.name}
      meta={`${phases.length} phase${multi ? 's' : ''} · ${plan.tax_rate_pct}% effective tax · Generated ${today()}`}
      headline={{
        label: multi ? 'Left over / mo (average)' : 'Left over / mo',
        value: docMoney(totals.avgLeftover),
        sub: `${docMoney(totals.avgLeftover * 12)} a year`,
        tone: totals.avgLeftover < 0 ? 'alert' : 'positive',
      }}
      disclaimer="Estimate using a flat effective tax rate. Real payroll varies with benefits and deductions."
    >
      <StatCards
        items={[
          { label: 'Gross income / mo', value: docMoney(per(totals.totalGross)), sub: avgNote ?? 'Before tax' },
          { label: 'Take home / mo', value: docMoney(per(totals.totalNet)), sub: `After ${plan.tax_rate_pct}% tax` },
          { label: 'Expenses / mo', value: docMoney(per(totals.totalExpenses)), sub: avgNote ?? 'Everything in this plan' },
        ]}
      />

      {phases.map(({ phase, c }, i) => {
        const items = [...phase.expenses].filter((e) => e.name || e.amount).sort((a, b) => b.amount - a.amount)
        return (
          <section key={i} className="card !p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <Eyebrow>Phase {i + 1}</Eyebrow>
                <h2 className="mt-1.5 text-[20px] leading-[1.25] font-bold break-words">{phase.name || `Phase ${i + 1}`}</h2>
                <p className="tnum mt-1 text-[12.5px] leading-[1.4] text-muted-foreground">
                  Gross {docMoney(phase.gross_income)} · Take home {docMoney(c.netIncome)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`tnum text-[22px] leading-[1.25] font-bold ${c.leftover < 0 ? 'text-alert' : 'text-primary'}`}>
                  {docMoney(c.leftover)}
                </p>
                <p className="text-[12px] leading-[1.4] font-medium text-muted-foreground">left each month</p>
                <p className="tnum mt-0.5 text-[12px] leading-[1.4] text-muted-foreground">
                  {docMoney(c.totalExpenses)} spent · {c.netIncome > 0 ? Math.round((c.totalExpenses / c.netIncome) * 100) : 0}% of take home
                </p>
              </div>
            </div>

            {items.length > 0 ? (
              <table className="mt-5 w-full border-collapse text-[13.5px] leading-[1.4]">
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Category</Th>
                    <Th right>Monthly</Th>
                    <Th right>Share</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e, j) => (
                    <tr key={j} className="border-t border-hairline">
                      <td className="py-2.5 pr-4">{e.name || 'Unnamed'}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {e.category ? (
                          <>
                            <Dot color={categoryColor(e.category)} />
                            {categoryLabel(e.category)}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="tnum py-2.5 text-right font-semibold">{docMoney(e.amount)}</td>
                      <td className="tnum py-2.5 pl-4 text-right text-muted-foreground">
                        {c.totalExpenses > 0 ? `${Math.round((e.amount / c.totalExpenses) * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border">
                    <td className="pt-3 font-semibold" colSpan={2}>
                      Total
                    </td>
                    <td className="tnum pt-3 text-right font-bold">{docMoney(c.totalExpenses)}</td>
                    <td className="tnum pt-3 pl-4 text-right text-muted-foreground">100%</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="mt-4 text-[13px] text-muted-foreground">No expenses in this phase.</p>
            )}
          </section>
        )
      })}

      {plan.notes && <Notes text={plan.notes} />}
    </Doc>
  )
}

/* ---------- Plan comparison ---------- */

const COMPARE_ROWS: { key: CompareMetric | 'phaseCount'; label: string }[] = [
  { key: 'tax_rate_pct', label: 'Effective tax rate' },
  { key: 'phaseCount', label: 'Phases' },
  { key: 'totalGross', label: 'Total gross income' },
  { key: 'totalNet', label: 'Total take home' },
  { key: 'totalExpenses', label: 'Total expenses' },
  { key: 'totalLeftover', label: 'Total left over' },
  { key: 'avgLeftover', label: 'Left over / mo (average)' },
]
const SUMMED = new Set(['totalGross', 'totalNet', 'totalExpenses', 'totalLeftover'])

export function CompareExportDoc({ plans }: { plans: PlannerPlan[] }) {
  const totals = new Map(plans.map((p) => [p.id, computePlanTotals(p)]))
  const value = (p: PlannerPlan, key: (typeof COMPARE_ROWS)[number]['key']) =>
    key === 'tax_rate_pct' ? p.tax_rate_pct : (totals.get(p.id)?.[key] ?? 0)
  const fmt = (key: (typeof COMPARE_ROWS)[number]['key'], v: number) =>
    key === 'tax_rate_pct' ? `${v}%` : key === 'phaseCount' ? String(v) : docMoney(v)
  const samePhaseCount = new Set(plans.map((p) => p.phases.length)).size === 1
  const best = [...plans].sort((a, b) => (totals.get(b.id)?.avgLeftover ?? 0) - (totals.get(a.id)?.avgLeftover ?? 0))[0]

  return (
    <Doc
      kind="Plan comparison"
      title={plans.map((p) => p.name).join(' vs ')}
      meta={`${plans.length} plans · Generated ${today()}`}
      headline={best ? { label: 'Leaves the most each month', value: best.name, sub: `${docMoney(totals.get(best.id)?.avgLeftover ?? 0)} / mo`, tone: 'positive' } : undefined}
      disclaimer="Estimates using each plan's flat effective tax rate. Green marks the better number in each row."
    >
      <section className="card !p-6">
        <table className="w-full border-collapse text-[14px] leading-[1.4]">
          <thead>
            <tr>
              <Th>Metric</Th>
              {plans.map((p) => (
                <th key={p.id} className="pb-2.5 pl-4 text-right text-[14px] leading-[1.35] font-bold">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => {
              const vals = plans.map((p) => ({ planId: p.id, value: value(p, row.key) }))
              const winners =
                row.key === 'phaseCount' || (SUMMED.has(row.key) && !samePhaseCount)
                  ? new Set<string>()
                  : winningPlanIds(vals, METRIC_LOWER_IS_BETTER[row.key as CompareMetric])
              return (
                <tr key={row.key} className="border-t border-hairline">
                  <td className="py-3 text-muted-foreground">{row.label}</td>
                  {vals.map(({ planId, value: v }) => (
                    <td key={planId} className="tnum py-3 pl-4 text-right font-semibold">
                      {winners.has(planId) && winners.size < plans.length ? (
                        <span className="text-primary">{fmt(row.key, v)}</span>
                      ) : (
                        fmt(row.key, v)
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 2)}, minmax(0, 1fr))` }}>
        {plans.map((p) => (
          <section key={p.id} className="card !p-5">
            <Eyebrow>{p.phases.length} phase{p.phases.length === 1 ? '' : 's'}</Eyebrow>
            <h2 className="mt-1 text-[17px] leading-[1.3] font-bold break-words">{p.name}</h2>
            <div className="mt-3 space-y-2">
              {p.phases.map((ph, i) => {
                const c = computePhase(ph, p.tax_rate_pct)
                return (
                  <div key={i} className="flex items-start justify-between gap-3 border-t border-hairline pt-2 text-[13px] leading-[1.4]">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{ph.name || `Phase ${i + 1}`}</p>
                      <p className="tnum text-[12px] text-muted-foreground">
                        {docMoney(c.netIncome)} take home · {docMoney(c.totalExpenses)} out
                      </p>
                    </div>
                    <p className={`tnum shrink-0 font-semibold ${c.leftover < 0 ? 'text-alert' : 'text-primary'}`}>{docMoney(c.leftover)}</p>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </Doc>
  )
}

/* ---------- Monthly close ---------- */

export function MonthlyCloseExportDoc({ snapshot }: { snapshot: MonthlySnapshot }) {
  const cats = Object.entries(snapshot.expenses_by_category).sort((a, b) => b[1] - a[1])
  const total = cats.reduce((s, [, v]) => s + v, 0)
  return (
    <Doc
      kind="Monthly close"
      title={monthLabel(snapshot.month)}
      meta={`${snapshot.locked_at ? `Closed ${new Date(snapshot.locked_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Not closed yet'} · Generated ${today()}`}
      headline={{
        label: 'Left over',
        value: docMoney(snapshot.disposable_income, snapshot.currency_code),
        sub: `${Math.round(snapshot.savings_rate)}% of take home`,
        tone: snapshot.disposable_income < 0 ? 'alert' : 'positive',
      }}
      disclaimer="Figures as recorded in Loot when the month was closed."
    >
      <StatCards
        items={[
          { label: 'Gross income', value: docMoney(snapshot.gross_income, snapshot.currency_code) },
          { label: 'Take home', value: docMoney(snapshot.net_income, snapshot.currency_code) },
          { label: 'Going out', value: docMoney(snapshot.total_expenses, snapshot.currency_code) },
          ...(snapshot.net_worth !== null ? [{ label: 'Net worth', value: docMoney(snapshot.net_worth, snapshot.currency_code) }] : []),
        ]}
      />
      {cats.length > 0 && (
        <section className="card !p-6">
          <h2 className="text-[17px] leading-[1.3] font-bold">Where it went</h2>
          <table className="mt-4 w-full border-collapse text-[13.5px] leading-[1.4]">
            <thead>
              <tr>
                <Th>Category</Th>
                <Th right>Monthly</Th>
                <Th right>Share</Th>
              </tr>
            </thead>
            <tbody>
              {cats.map(([cat, amount]) => (
                <tr key={cat} className="border-t border-hairline">
                  <td className="py-2.5">
                    <Dot color={categoryColor(cat)} />
                    {categoryLabel(cat)}
                  </td>
                  <td className="tnum py-2.5 text-right font-semibold">{docMoney(amount, snapshot.currency_code)}</td>
                  <td className="tnum py-2.5 pl-4 text-right text-muted-foreground">{total > 0 ? `${Math.round((amount / total) * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {snapshot.close_notes && <Notes text={snapshot.close_notes} />}
    </Doc>
  )
}
