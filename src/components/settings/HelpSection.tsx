import { Link } from '@tanstack/react-router'
import { ChevronDown, HelpCircle, PlayCircle } from 'lucide-react'
import { useTutorialContext } from '@/context/TutorialContext'
import { NAV_GROUPS } from '@/lib/nav'
import { SettingsHeading } from '@/components/settings/SettingsHeading'

const GUIDE: Record<string, string> = {
  '/dashboard': 'Your monthly position at a glance, plus your Loot Score, forecast, close and briefing.',
  '/stats': 'Trends over time, category history, benchmarks and net worth.',
  '/expenses': 'Every recurring cost, fixed and variable. Removed items wait in “Recently removed”.',
  '/goals': 'Savings targets with monthly contributions, a 24-month timeline and a shortfall check.',
  '/checker': 'Ask “can I afford this?” — once-off or monthly — and get a straight answer.',
  '/statement': 'Upload a bank statement (PDF, CSV or OFX) for an instant category breakdown. Parsed in your browser.',
  '/planner': 'Multi-phase salary plans and a debt-payoff planner (avalanche vs snowball).',
  '/compare': 'Put two to four saved plans side by side.',
  '/tax': 'SARS estimate, provisional tax, deductions, key dates, eFiling guide and glossary.',
  '/settings': 'Your profile, income, preferences, household and data.',
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is “available loot”?',
    a: 'Your net (take-home) income minus every monthly-equivalent expense you track. It is the money that is genuinely free — not your bank balance, which includes money already spoken for.',
  },
  {
    q: 'How are weekly and annual expenses counted?',
    a: 'Everything is converted to a monthly equivalent: weekly amounts × 52 ÷ 12 and annual amounts ÷ 12. Once-off items are listed but don’t count towards the monthly total.',
  },
  {
    q: 'Is my bank statement uploaded anywhere?',
    a: 'No. Statements are read entirely in your browser. Only the category totals (never individual transactions) are saved if you choose to keep an analysis.',
  },
  {
    q: 'What is the Loot Score?',
    a: 'A locally-calculated estimate of your credit health from your debt-to-income, savings rate, spending consistency and card utilisation. It is not a real bureau score — upload a real one to see how the two compare.',
  },
  {
    q: 'What does the monthly close do?',
    a: 'It lets you confirm a month’s numbers and lock them. A locked month is frozen — later changes to your income or expenses won’t rewrite it — and it unlocks that month’s briefing.',
  },
  {
    q: 'How does household mode work?',
    a: 'Invite a partner by email under Settings → Household. Once they accept (they need a Loot account with that email), you can switch to a combined view of income and expenses. Each of you can still switch back to your own.',
  },
  {
    q: 'Are the tax figures official?',
    a: 'They use the published SARS tables and are estimates only — not tax advice. Always check your assessment on SARS eFiling.',
  },
  {
    q: 'Can I get my data out?',
    a: 'Yes. Settings → Your data → Export downloads everything as a JSON file.',
  },
]

export function HelpSection() {
  const { start } = useTutorialContext()

  return (
    <section className="card space-y-5">
      <SettingsHeading icon={HelpCircle} title="Help" color="var(--chart-3)" description="How Loot works, feature by feature." />

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-medium">Guided tour</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Replay the two-minute walkthrough of every page.</p>
        </div>
        <button type="button" onClick={start} className="btn btn-secondary shrink-0">
          <PlayCircle size={15} strokeWidth={2} />
          Replay
        </button>
      </div>

      <div className="border-t border-hairline pt-4">
        <h3 className="mb-2 text-[15px] font-semibold">Feature guide</h3>
        <ul className="-mx-2 space-y-0.5">
          {NAV_GROUPS.flatMap((g) => g.items)
            .filter((item) => GUIDE[item.to])
            .map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <Link to={item.to} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-fill">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-fill-2 text-muted-foreground"><Icon size={15} strokeWidth={2} /></span>
                    <span className="text-[15px]">
                      <span className="font-medium">{item.label}</span>
                      <span className="block text-[13px] text-muted-foreground">{GUIDE[item.to]}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
        </ul>
      </div>

      <div className="border-t border-hairline pt-4">
        <h3 className="mb-2 text-[15px] font-semibold">Frequently asked</h3>
        <div className="-mx-2 space-y-0.5">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-xl px-2 py-2.5 transition-colors hover:bg-fill">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown size={15} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Tax terms explained in plain English are in the{' '}
          <Link to="/tax" className="font-semibold text-primary">
            Tax centre glossary
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
