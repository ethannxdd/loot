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
import { computePhase, itemMonthly, peakPhaseIndex } from '@/lib/planner-math'
import { COMPARE_ROWS, computePlanTotals, METRIC_LOWER_IS_BETTER, winningPlanIds, type CompareMetric } from '@/lib/plan-compare'
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

const FREQ_LABEL: Record<string, string> = { monthly: 'Monthly', weekly: 'Weekly', annual: 'Annual', 'once-off': 'Once-off' }

export function PlanExportDoc({ plan, currentNet = 0 }: { plan: PlannerPlan; currentNet?: number }) {
  const phases = plan.phases.map((p) => ({ phase: p, c: computePhase(p, plan.tax_rate_pct) }))
  const multi = phases.length > 1
  const peak = peakPhaseIndex(plan.phases, plan.tax_rate_pct)
  const top = peak >= 0 ? phases[peak].c : null

  return (
    <Doc
      kind="Salary planner"
      title={plan.name}
      meta={`${phases.length} phase${multi ? 's' : ''} · ${plan.tax_rate_pct}% effective tax · Generated ${today()}`}
      headline={{
        label: multi ? 'Salary needed (highest phase)' : 'Salary needed',
        value: docMoney(top?.requiredGross ?? 0),
        sub: `gross / month · ${docMoney(top?.requiredAnnualGross ?? 0)} a year`,
        tone: 'positive',
      }}
      disclaimer="Rough estimate at a flat effective tax rate. Real payroll deductions vary with UIF, pension, medical aid and bracket edges."
    >
      <StatCards
        items={[
          { label: 'Take-home needed / mo', value: docMoney(top?.requiredNet ?? 0), sub: multi ? `In ${phases[peak]?.phase.name}` : 'Expenses + leftover target' },
          { label: 'Monthly expenses', value: docMoney(top?.totalExpenses ?? 0), sub: 'Monthly equivalent' },
          { label: 'Leftover target / mo', value: docMoney(top?.leftoverTarget ?? 0), sub: 'On top of expenses' },
        ]}
      />

      {currentNet > 0 && top && top.requiredNet > 0 && (
        <section className="card !p-5">
          <Eyebrow>Compared with today</Eyebrow>
          <p className="mt-2 text-[14px] leading-[1.5]">
            {currentNet >= top.requiredNet
              ? `Your current take-home of ${docMoney(currentNet)} already covers this by ${docMoney(currentNet - top.requiredNet)} a month.`
              : `Your current take-home of ${docMoney(currentNet)} is ${docMoney(top.requiredNet - currentNet)} a month short of this.`}
          </p>
        </section>
      )}

      {phases.map(({ phase, c }, i) => {
        const items = [...phase.expenses]
          .filter((e) => e.name || e.amount)
          .map((e) => ({ e, monthly: itemMonthly(e, phase.months) }))
          .sort((a, b) => b.monthly - a.monthly || b.e.amount - a.e.amount)
        return (
          <section key={i} className="card !p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <Eyebrow>Phase {i + 1}{phase.months ? ` · ${phase.months} months` : ''}</Eyebrow>
                <h2 className="mt-1.5 text-[20px] leading-[1.25] font-bold break-words">{phase.name || `Phase ${i + 1}`}</h2>
                <p className="tnum mt-1 text-[12.5px] leading-[1.4] text-muted-foreground">
                  Spend {docMoney(c.totalExpenses)} + keep {docMoney(c.leftoverTarget)} = take home {docMoney(c.requiredNet)}
                </p>
                {c.hasSalary && (
                  <p className="tnum mt-0.5 text-[12.5px] leading-[1.4] text-muted-foreground">
                    Tested salary {docMoney(phase.gross_income)} takes home {docMoney(c.netIncome)} ({c.netIncome >= c.requiredNet ? `${docMoney(c.netIncome - c.requiredNet)} spare` : `${docMoney(c.requiredNet - c.netIncome)} short`})
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="tnum text-[22px] leading-[1.25] font-bold text-primary">{docMoney(c.requiredGross)}</p>
                <p className="text-[12px] leading-[1.4] font-medium text-muted-foreground">gross needed / month</p>
                <p className="tnum mt-0.5 text-[12px] leading-[1.4] text-muted-foreground">{docMoney(c.requiredAnnualGross)} a year</p>
              </div>
            </div>

            {items.length > 0 ? (
              <table className="mt-5 w-full border-collapse text-[13.5px] leading-[1.4]">
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Category</Th>
                    <Th>How often</Th>
                    <Th right>Amount</Th>
                    <Th right>Monthly</Th>
                    <Th right>Share</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ e, monthly }, j) => (
                    <tr key={j} className="border-t border-hairline">
                      <td className="py-2.5 pr-3">{e.name || 'Unnamed'}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {e.category ? (
                          <>
                            <Dot color={categoryColor(e.category)} />
                            {categoryLabel(e.category)}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{FREQ_LABEL[e.frequency ?? 'monthly']}</td>
                      <td className="tnum py-2.5 text-right">{docMoney(e.amount)}</td>
                      <td className="tnum py-2.5 pl-3 text-right font-semibold">
                        {monthly > 0 ? docMoney(monthly) : 'Up front'}
                      </td>
                      <td className="tnum py-2.5 pl-3 text-right text-muted-foreground">
                        {c.totalExpenses > 0 && monthly > 0 ? `${Math.round((monthly / c.totalExpenses) * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border">
                    <td className="pt-3 font-semibold" colSpan={4}>
                      Monthly total
                    </td>
                    <td className="tnum pt-3 pl-3 text-right font-bold">{docMoney(c.totalExpenses)}</td>
                    <td className="tnum pt-3 pl-3 text-right text-muted-foreground">100%</td>
                  </tr>
                  {c.upfront > 0 && (
                    <tr>
                      <td className="pt-1.5 text-muted-foreground" colSpan={4}>
                        Once-off, paid up front
                      </td>
                      <td className="tnum pt-1.5 pl-3 text-right font-semibold">{docMoney(c.upfront)}</td>
                      <td />
                    </tr>
                  )}
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

export function CompareExportDoc({ plans }: { plans: PlannerPlan[] }) {
  const totals = new Map(plans.map((p) => [p.id, computePlanTotals(p)]))
  const value = (p: PlannerPlan, key: (typeof COMPARE_ROWS)[number]['key']) =>
    key === 'tax_rate_pct' ? p.tax_rate_pct : (totals.get(p.id)?.[key] ?? 0)
  const fmt = (key: (typeof COMPARE_ROWS)[number]['key'], v: number) =>
    key === 'tax_rate_pct' ? `${v}%` : key === 'phaseCount' ? String(v) : docMoney(v)
  const cheapest = [...plans].sort((a, b) => (totals.get(a.id)?.peakGross ?? 0) - (totals.get(b.id)?.peakGross ?? 0))[0]

  return (
    <Doc
      kind="Plan comparison"
      title={plans.map((p) => p.name).join(' vs ')}
      meta={`${plans.length} plans · Generated ${today()}`}
      headline={
        cheapest
          ? { label: 'Needs the lowest salary', value: cheapest.name, sub: `${docMoney(totals.get(cheapest.id)?.peakGross ?? 0)} gross / mo`, tone: 'positive' }
          : undefined
      }
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
              const winners = row.key === 'phaseCount' ? new Set<string>() : winningPlanIds(vals, METRIC_LOWER_IS_BETTER[row.key as CompareMetric])
              return (
                <tr key={row.key} className="border-t border-hairline">
                  <td className="py-3 text-muted-foreground">{row.label}</td>
                  {vals.map(({ planId, value: v }) => (
                    <td key={planId} className="tnum py-3 pl-4 text-right font-semibold">
                      {winners.has(planId) && winners.size < plans.length ? <span className="text-primary">{fmt(row.key, v)}</span> : fmt(row.key, v)}
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
                        {docMoney(c.totalExpenses)} spend · {docMoney(c.leftoverTarget)} to keep
                      </p>
                    </div>
                    <p className="tnum shrink-0 font-semibold text-primary">{docMoney(c.requiredGross)}</p>
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
