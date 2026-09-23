const TONE = {
  green: 'var(--accent)',
  amber: 'var(--caution)',
  red: 'var(--alert)',
} as const

interface ScoreRingProps {
  score: number
  /** Top of the scale the score is on (999 TransUnion, 740 Experian/ClearScore, 100 habits rating…). */
  max?: number
  tone?: keyof typeof TONE
  size?: number
  /** Small line under the number; defaults to "of {max}". */
  caption?: string
}

/** Activity-style ring: a round-capped arc on a faint track, score in the middle. */
export function ScoreRing({ score, max = 999, tone = 'green', size = 112, caption }: ScoreRingProps) {
  const stroke = Math.max(8, size * 0.1)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, Math.max(0, score / max))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(score)} out of ${max}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum font-bold tracking-[-0.03em]" style={{ fontSize: size * 0.26 }}>
          {Math.round(score)}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">{caption ?? `of ${max}`}</span>
      </div>
    </div>
  )
}
