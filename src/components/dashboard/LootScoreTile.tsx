import { Link } from '@tanstack/react-router'
import { ChevronRight, Gauge } from 'lucide-react'
import { useLootScore } from '@/hooks/useLootScore'

const TONE = { green: 'var(--accent)', amber: 'var(--caution)', red: 'var(--alert)' } as const

/** Loot Score as a compact tile; the full breakdown lives in Settings → Loot Score. */
export function LootScoreTile() {
  const { view, isLoading } = useLootScore()
  if (isLoading || !view) return <div className="skeleton h-[138px] rounded-[22px]" />

  const r = 23
  const circ = 2 * Math.PI * r
  const ring =
    view.status === 'calibrated'
      ? { value: view.estimate, max: view.scale.max, tone: view.band.tone }
      : view.status === 'habits'
        ? { value: view.rating, max: 100, tone: view.habits.tone }
        : null

  return (
    <Link to="/settings" hash="loot-score" className="card card-hover flex h-full flex-col gap-1" aria-label="Loot Score — view details">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--chart-4)_16%,transparent)] text-[var(--chart-4)]">
          <Gauge size={15} strokeWidth={2.1} />
        </span>
        {view.status === 'calibrated' ? 'Est. credit score' : view.status === 'habits' ? 'Money habits' : 'Loot Score'}
        <ChevronRight size={15} className="ml-auto text-text-subtle" />
      </div>
      {view.status === 'insufficient' || !ring ? (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Not enough data yet —{' '}
          {view.status === 'insufficient' ? `${view.requirements.filter((x) => !x.done).length} step${view.requirements.filter((x) => !x.done).length === 1 ? '' : 's'} to go.` : ''} Add your real
          credit score to skip the wait.
        </p>
      ) : (
        <>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="tnum mt-1.5 text-[28px] font-bold tracking-[-0.03em]">
              {ring.value}
              <span className="text-[14px] font-semibold text-text-subtle"> / {ring.max}</span>
            </p>
            <svg width="54" height="54" viewBox="0 0 56 56" aria-hidden="true" className="-mt-2 shrink-0">
              <circle cx="28" cy="28" r={r} fill="none" stroke="var(--fill-2)" strokeWidth="7" />
              <circle
                cx="28"
                cy="28"
                r={r}
                fill="none"
                stroke={TONE[ring.tone]}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${(ring.value / ring.max) * circ} ${circ}`}
                transform="rotate(-90 28 28)"
              />
            </svg>
          </div>
          <span className="text-[12.5px] font-semibold text-muted-foreground">
            {view.status === 'calibrated' ? `${view.band.label} · ${view.anchor.bureau}` : `${view.habits.label} · add your credit score`}
          </span>
        </>
      )}
    </Link>
  )
}
