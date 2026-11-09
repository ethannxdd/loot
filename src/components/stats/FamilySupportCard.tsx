import { HeartHandshake } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useMonthLabels } from '@/hooks/useCycle'
import { useExpenses } from '@/hooks/useExpenses'
import { useProfile } from '@/hooks/useProfile'
import { categoryColor } from '@/lib/categories'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'
import { disposableIncome, monthlyEquivalent, savingsRate } from '@/lib/money'
import type { MonthlySnapshot } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

/**
 * Stats → Categories (§4.3): what you send to family, as a share of take-home, its trend, and your savings rate next to
 * it for context. Shown only when there's family support. Facts, no judgement.
 */
export function FamilySupportCard({ snapshots }: { snapshots: MonthlySnapshot[] }) {
  const { data: expenses = [] } = useExpenses()
  const { data: profile } = useProfile()
  const labels = useMonthLabels()
  const monthly = expenses.filter((e) => !e.deleted_at && e.category === 'family_support').reduce((s, e) => s + monthlyEquivalent(e), 0)
  const history = snapshots.slice(-12).map((s) => ({ month: labels.short(s.month), amount: Math.round(s.expenses_by_category?.family_support ?? 0) }))
  if (monthly <= 0 && history.every((h) => h.amount === 0)) return null

  const net = profile?.net_income ?? 0
  const pct = net > 0 ? (monthly / net) * 100 : 0
  const rate = savingsRate(disposableIncome(net, expenses), net)

  return (
    <section className="card space-y-4" data-testid="family-support-card">
      <div className="flex items-start gap-3">
        <span className="icon-tile" style={{ background: categoryColor('family_support') }}>
          <HeartHandshake size={17} strokeWidth={2} />
        </span>
        <div>
          <h3 className="card-title">Family support</h3>
          <p className="tnum text-[14px] text-muted-foreground">
            <b className="text-foreground">{Math.round(pct)}%</b> of take-home · {formatCurrency(monthly)} a month
          </p>
        </div>
      </div>
      {history.length > 1 && (
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => formatCurrency(Number(v))} cursor={{ fill: 'var(--fill)' }} />
              <Bar dataKey="amount" name="Family support" fill={categoryColor('family_support')} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[13px] text-muted-foreground">
        For context, you’re saving {Math.round(rate)}% of take-home. Supporting family is part of your plan, so Loot counts it like any other
        commitment.
      </p>
    </section>
  )
}
