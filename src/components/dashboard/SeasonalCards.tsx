import { Link } from '@tanstack/react-router'
import { CalendarHeart, ChevronRight, ShoppingBag } from 'lucide-react'
import { useContent } from '@/hooks/useContent'
import { useFeature } from '@/hooks/useFeatures'
import { inBlackFridayWindow } from '@/lib/tools/black-friday'
import { inJanuaryWindow } from '@/lib/tools/january'

/** Seasonal planner cards on Summary (§3.5), only inside their content-managed windows and with the tools flag. */
export function SeasonalCards() {
  const tools = useFeature('tools')
  const { seasons } = useContent()
  if (!tools) return null
  const today = new Date()
  const january = inJanuaryWindow(today, seasons.january_window)
  const blackFriday = inBlackFridayWindow(today, seasons.black_friday, seasons.black_friday_window_days_after)
  if (!january && !blackFriday) return null
  const bfDay = new Date(`${seasons.black_friday}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="seasonal-cards">
      {blackFriday && (
        <Link to="/tools/black-friday" className="card card-hover flex items-center gap-3.5">
          <span className="icon-tile" style={{ background: 'var(--chart-6)' }}>
            <ShoppingBag size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Black Friday is {bfDay}</span>
            <span className="block text-[13px] text-muted-foreground">Set your budget before the deals set it for you.</span>
          </span>
          <ChevronRight size={18} className="text-text-subtle" />
        </Link>
      )}
      {january && (
        <Link to="/tools/january" className="card card-hover flex items-center gap-3.5">
          <span className="icon-tile" style={{ background: 'var(--chart-1)' }}>
            <CalendarHeart size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Survive January</span>
            <span className="block text-[13px] text-muted-foreground">Work out what to keep from December pay for the long month.</span>
          </span>
          <ChevronRight size={18} className="text-text-subtle" />
        </Link>
      )}
    </div>
  )
}
