import type { ReactNode } from 'react'

export interface StatItem {
  label: string
  value: ReactNode
  /** Small colour key shown before the label. */
  color?: string
  /** Colours the value itself (e.g. net figures). */
  valueColor?: string
  sub?: ReactNode
}

/** A row of headline figures in one elevated card, separated by hairlines (2-up on phones). */
export function StatStrip({ items, className = '' }: { items: StatItem[]; className?: string }) {
  const cols = items.length >= 4 ? 'sm:grid-cols-4' : items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <section className={`card-elevated grid grid-cols-2 gap-y-5 sm:p-6 ${cols} ${className}`}>
      {items.map((s, i) => (
        <div key={s.label} className={`min-w-0 px-1 sm:px-5 ${i > 0 ? 'sm:border-l sm:border-hairline' : 'sm:pl-0'}`}>
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            {s.color && <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: s.color }} />}
            <span className="truncate">{s.label}</span>
          </p>
          <p className="tnum mt-1 truncate text-[24px] font-bold tracking-[-0.03em]" style={s.valueColor ? { color: s.valueColor } : undefined}>
            {s.value}
          </p>
          {s.sub && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{s.sub}</div>}
        </div>
      ))}
    </section>
  )
}
