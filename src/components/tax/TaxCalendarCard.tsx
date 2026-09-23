import { parseDateOnly } from '@/lib/goal-math'
import { getCalendarWithCountdowns } from '@/lib/tax/calendar'

const URGENCY_STYLES: Record<string, string> = {
  past: 'chip-neutral',
  soon: 'chip-alert',
  upcoming: 'chip-caution',
  far: 'chip-neutral',
}

export function TaxCalendarCard({ isProvisional = false }: { isProvisional?: boolean }) {
  const entries = getCalendarWithCountdowns(new Date(), isProvisional)

  return (
    <div className="card sm:p-6">
      <h3 className="card-title mb-2">Tax calendar</h3>
      <div className="divide-y divide-hairline">
        {entries.map((e) => {
          const d = parseDateOnly(e.date)
          return (
            <div key={e.id} className={`flex gap-3 py-3 ${e.urgency === 'past' ? 'opacity-55' : ''}`}>
              <span className="w-10 shrink-0 overflow-hidden rounded-[10px] bg-surface-2 text-center ring-1 ring-hairline" aria-hidden="true">
                <span className="block h-[13px] bg-[#ff3b30] text-[9px] font-bold uppercase leading-[13px] tracking-[0.06em] text-white">
                  {d.toLocaleDateString('en-ZA', { month: 'short' })}
                </span>
                <span className="tnum block text-[17px] font-semibold leading-[27px] tracking-[-0.02em]">{d.getDate()}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold leading-snug">{e.label}</p>
                  <span className={`chip shrink-0 !h-6 !text-[11.5px] ${URGENCY_STYLES[e.urgency]}`}>
                    {e.daysUntil > 0 ? `${e.daysUntil} days` : e.daysUntil === 0 ? 'Today' : 'Passed'}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{e.description}</p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        SARS announces each filing season’s deadlines around mid-year — they’re added here once gazetted.
      </p>
    </div>
  )
}
