import { Link } from '@tanstack/react-router'
import { CalendarClock, ChevronRight, TrendingUp } from 'lucide-react'
import { useContent } from '@/hooks/useContent'
import { useExpenses } from '@/hooks/useExpenses'
import { useFeature } from '@/hooks/useFeatures'
import { usePriceEvents, useRenewals } from '@/hooks/useStayAhead'
import { comingUp } from '@/lib/stay-ahead'
import { formatCurrency } from '@/lib/utils'

/** Summary card "Coming up in costs" (§4.6): the next two renewals / price changes that affect you. */
export function ComingUpCosts() {
  const on = useFeature('renewals')
  const { data: renewals = [] } = useRenewals()
  const { data: events = [] } = usePriceEvents()
  const { data: expenses = [] } = useExpenses()
  const content = useContent()
  if (!on) return null
  const items = comingUp({ renewals, events, expenses, fuelPrice: content.fuel_prices.petrol95.inland }).slice(0, 2)
  if (items.length === 0) return null

  return (
    <section className="card" data-testid="coming-up-costs">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="card-title">Coming up in costs</h3>
        <Link to="/renewals" className="text-[13px] font-semibold text-primary">
          All
        </Link>
      </div>
      <ul className="divide-y divide-hairline">
        {items.map((t) => (
          <li key={t.key}>
            <Link to={t.link} className="flex items-center gap-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-fill">
                {t.type === 'renewal' ? <CalendarClock size={15} /> : <TrendingUp size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{t.title}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">
                  {t.date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} · {t.detail}
                </span>
              </span>
              {t.amount !== null && (
                <span className="tnum shrink-0 text-[13.5px] font-semibold">{t.type === 'renewal' ? formatCurrency(t.amount) : `+${formatCurrency(t.amount)}/mo`}</span>
              )}
              <ChevronRight size={15} className="shrink-0 text-text-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
