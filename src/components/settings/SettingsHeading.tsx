import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Settings-app style section heading: a coloured icon tile, a title and an optional one-line description. */
export function SettingsHeading({
  icon: Icon,
  title,
  color = 'var(--accent)',
  description,
  trailing,
}: {
  icon: LucideIcon
  title: string
  color?: string
  description?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-white" style={{ background: color }} aria-hidden>
        <Icon size={17} strokeWidth={2.1} />
      </span>
      <div className="min-w-0 flex-1 pt-[3px]">
        <h2 className="card-title">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</p>}
      </div>
      {trailing}
    </div>
  )
}
