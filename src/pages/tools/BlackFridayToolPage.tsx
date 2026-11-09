import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { docMoney } from '@/components/export/ExportDocs'
import { NumberField, ResultRow, ToolShell } from '@/components/tools/ToolShell'
import { SwitchRow } from '@/components/ui/Switch'
import { useContent } from '@/hooks/useContent'
import { useWishlist } from '@/hooks/useDecide'
import { useFeature } from '@/hooks/useFeatures'
import { useGoals } from '@/hooks/useGoals'
import { useSafeToSpend } from '@/hooks/useSpendEntries'
import { requiredMonthlyContribution } from '@/lib/goal-math'
import { blackFridayBudget, blackFridayWeekend, checkItems } from '@/lib/tools/black-friday'
import { formatCurrency } from '@/lib/utils'
import { VERDICT_META } from '@/lib/verdict'

interface BfInputs {
  ringFenced: number
  pause: boolean
}

/** /tools/black-friday (§3.5): a budget from Safe to spend and the wishlist items tagged Black Friday. */
export function BlackFridayToolPage() {
  const content = useContent()
  const stats = useSafeToSpend()
  const { data: wish = [] } = useWishlist()
  const { data: goals = [] } = useGoals()
  const wishlistOn = useFeature('wishlist')
  const [inputs, setInputs] = useState<BfInputs>({ ringFenced: 0, pause: false })
  const date = content.seasons.black_friday
  const day = new Date(`${date}T00:00:00`)
  // Projected Safe to spend on the day: today's figure, less the daily allowance until then.
  const daysUntil = Math.max(0, Math.round((day.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000))
  const projected = stats.live ? Math.max(0, stats.safe - stats.perDay * Math.min(daysUntil, stats.daysLeft)) : Math.max(0, stats.planned)
  const activeGoals = goals.filter((g) => !g.is_completed && !g.is_paused)
  const contributions = activeGoals.reduce((s, g) => s + requiredMonthlyContribution(g), 0)
  const budget = blackFridayBudget({ safeOnTheDay: projected, ringFenced: inputs.ringFenced, pausedContributions: inputs.pause ? contributions : 0, buffer: stats.buffer })
  const items = wish
    .filter((w) => w.tags.includes('black_friday') && w.status !== 'dropped')
    .map((w) => ({ id: w.id, name: w.name, price: w.price, targetPrice: w.target_price }))
  const rows = checkItems(items, budget, stats.buffer)
  const total = rows.at(-1)?.runningTotal ?? 0
  const weekend = blackFridayWeekend(date)
  const after = new Date().getTime() > weekend.end.getTime()
  const spentThatWeekend = stats.entries
    .filter((e) => {
      const t = new Date(e.spent_at).getTime()
      return t >= weekend.start.getTime() && t < weekend.end.getTime()
    })
    .reduce((s, e) => s + e.amount, 0)

  return (
    <ToolShell
      tool="black_friday"
      title="Black Friday"
      subtitle={`${day.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}. Decide your budget now, so the deals don’t decide it for you.`}
      inputs={inputs}
      onLoad={setInputs}
      headline={{ label: 'Black Friday budget', value: docMoney(budget) }}
      exportRows={[
        { section: 'Budget', label: 'Projected Safe to spend on the day', value: docMoney(projected) },
        { section: 'Budget', label: 'Ring-fenced', value: docMoney(inputs.ringFenced) },
        ...(inputs.pause ? [{ section: 'Budget', label: 'Paused goal contributions', value: docMoney(contributions) }] : []),
        { section: 'Budget', label: 'Budget', value: docMoney(budget), strong: true },
        ...rows.map((r) => ({ section: 'List', label: `${r.name} · ${VERDICT_META[r.verdict].label}`, value: docMoney(r.cost) })),
        { section: 'List', label: 'Total', value: docMoney(total), strong: true },
      ]}
      form={
        <>
          <NumberField id="bf-ring" label="Ring-fence (won’t touch)" value={inputs.ringFenced} onChange={(n) => setInputs((s) => ({ ...s, ringFenced: n }))} />
          {activeGoals.length > 0 && (
            <SwitchRow
              checked={inputs.pause}
              onChange={(pause) => setInputs((s) => ({ ...s, pause }))}
              label="Pause goal contributions this cycle"
              hint={`Adds ${formatCurrency(contributions)}, but delays ${activeGoals[0].name}${activeGoals.length > 1 ? ' and others' : ''} by about a month.`}
            />
          )}
          {!stats.live && <p className="text-[13px] text-muted-foreground">Turn on payday cycles to project Safe to spend on the day. For now this uses your planned free money.</p>}
        </>
      }
      results={
        <>
          <section className="card-elevated space-y-1 sm:p-6">
            <p className="text-[13px] text-muted-foreground">Your Black Friday budget</p>
            <p className="tnum text-[40px] leading-none font-bold tracking-[-0.04em]">{formatCurrency(budget)}</p>
            {items.length > 0 && (
              <p className={`pt-1 text-[14px] ${total > budget ? 'text-alert' : 'text-muted-foreground'}`}>
                Your list comes to {formatCurrency(total)}{total > budget ? `, ${formatCurrency(total - budget)} over.` : '.'}
              </p>
            )}
          </section>
          <section className="card">
            <h3 className="card-title mb-2">Your list</h3>
            {rows.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">
                {wishlistOn ? (
                  <>
                    Tag wishlist items “For Black Friday” to plan them here.{' '}
                    <Link to="/wishlist" className="font-semibold text-primary">
                      Open wishlist
                    </Link>
                  </>
                ) : (
                  'Add the things you’re waiting for, with the price you’d pay.'
                )}
              </p>
            ) : (
              rows.map((r) => (
                <ResultRow
                  key={r.id}
                  label={`${r.name}${r.targetPrice ? ` (target ${formatCurrency(r.targetPrice)})` : ''}`}
                  value={`${formatCurrency(r.cost)} · ${VERDICT_META[r.verdict].label}`}
                  tone={r.verdict === 'comfortable' ? 'positive' : r.verdict === 'tight' ? 'caution' : 'alert'}
                />
              ))
            )}
          </section>
          {after && stats.live && (
            <section className="card">
              <ResultRow label="You spent over the weekend" value={`${formatCurrency(Math.max(0, spentThatWeekend))} of ${formatCurrency(budget)}`} strong tone={spentThatWeekend > budget ? 'alert' : 'positive'} />
            </section>
          )}
        </>
      }
    />
  )
}
