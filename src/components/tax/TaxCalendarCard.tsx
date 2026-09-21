import { Calendar } from 'lucide-react'
import { getCalendarWithCountdowns } from '@/lib/tax/calendar'

const URGENCY_STYLES: Record<string, string> = {
  past: 'text-text-subtle',
  soon: 'text-alert',
  upcoming: 'text-caution',
  far: 'text-muted-foreground',
}

export function TaxCalendarCard() {
  const entries = getCalendarWithCountdowns()

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <Calendar size={18} strokeWidth={1.75} className="text-secondary" />
        <h3 className="text-base font-bold">Tax calendar</h3>
      </div>
      {entries.map((e) => (
        <div key={e.id} className="rounded-lg bg-surface-2 px-3.5 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{e.label}</p>
            <span className={`tnum text-xs font-bold ${URGENCY_STYLES[e.urgency]}`}>
              {e.daysUntil >= 0 ? `${e.daysUntil}d` : 'Passed'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
        </div>
      ))}
    </div>
  )
}
