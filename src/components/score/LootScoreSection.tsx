import { Check, Circle, Gauge } from 'lucide-react'
import { SettingsHeading } from '@/components/settings/SettingsHeading'
import { BureauScoreUpload } from '@/components/score/BureauScoreUpload'
import { FactorBreakdown } from '@/components/score/FactorBreakdown'
import { ScoreRing } from '@/components/score/ScoreRing'
import { ScoreTimelineChart } from '@/components/score/ScoreTimelineChart'
import { useBureauScores } from '@/hooks/useBureauScores'
import { useLootScore } from '@/hooks/useLootScore'
import { scoreRecommendations } from '@/lib/budge-score'
import { bureauScaleMax } from '@/lib/loot-score'
import type { ScoreFactors } from '@/lib/types'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

function Recommendations({ factors }: { factors: ScoreFactors }) {
  const recs = scoreRecommendations(factors)
  if (recs.length === 0)
    return <p className="rounded-2xl bg-fill p-4 text-[14px] text-muted-foreground">Nothing to fix right now — keep doing what you’re doing.</p>
  return (
    <div className="rounded-2xl bg-fill p-4">
      <h3 className="mb-2 text-[15px] font-semibold">How to improve it</h3>
      <ul className="space-y-2">
        {recs.map((r) => (
          <li key={r.factor} className="flex gap-2.5 text-[14px] leading-relaxed text-muted-foreground">
            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {r.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Settings → Loot Score. Three honest states: not enough data, habits only, and calibrated to a real bureau score. */
export function LootScoreSection() {
  const { view, isLoading, history } = useLootScore()
  const { data: bureauScores = [] } = useBureauScores()

  if (isLoading || !view) return <div className="skeleton h-48 rounded-[22px]" />

  const indexNow = history.length > 0 ? history[history.length - 1].score : null

  return (
    <section id="loot-score" className="card scroll-mt-6 space-y-5">
      <SettingsHeading
        icon={Gauge}
        title="Loot Score"
        color="var(--chart-1)"
        description="Rates your money habits, and estimates your credit score once you add a real one."
      />

      {view.status === 'insufficient' && (
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Not enough information yet for a fair score. Here’s what Loot still needs:
          </p>
          <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-fill">
            {view.requirements.map((r) => (
              <li key={r.key} className="flex items-center gap-3 px-4 py-3">
                {r.done ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : (
                  <Circle size={24} strokeWidth={1.6} className="text-text-subtle" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-[15px] font-medium ${r.done ? 'text-muted-foreground line-through decoration-1' : ''}`}>{r.label}</p>
                  {r.detail && !r.done && <p className="text-[12.5px] text-muted-foreground">{r.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-muted-foreground">
            Already know your credit score? Add it below and Loot can start estimating straight away.
          </p>
        </div>
      )}

      {view.status === 'habits' && (
        <>
          <div className="flex items-center gap-5">
            <ScoreRing score={view.rating} max={100} tone={view.habits.tone} size={112} caption="habits" />
            <div className="min-w-0 space-y-1.5">
              <p className="text-[22px] font-bold tracking-[-0.02em]">{view.habits.label}</p>
              {view.delta !== null && view.delta !== 0 && (
                <span className={`chip ${view.delta > 0 ? 'chip-positive' : 'chip-alert'}`}>
                  {view.delta > 0 ? '+' : ''}
                  {view.delta} vs last month
                </span>
              )}
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Your money-habits rating out of 100. Add your real credit score below to see an estimated score on your
                bureau’s scale.
              </p>
            </div>
          </div>
          <div className="border-t border-hairline pt-5">
            <h3 className="mb-3 text-[15px] font-semibold">What makes up your rating</h3>
            <FactorBreakdown factors={view.factors} />
          </div>
          <Recommendations factors={view.factors} />
        </>
      )}

      {view.status === 'calibrated' && (
        <>
          <div className="flex items-center gap-5">
            <ScoreRing score={view.estimate} max={view.scale.max} tone={view.band.tone} size={112} />
            <div className="min-w-0 space-y-1.5">
              <p className="text-[13px] font-medium text-muted-foreground">Estimated credit score</p>
              <p className="text-[22px] leading-tight font-bold tracking-[-0.02em]">{view.band.label}</p>
              {view.next && (
                <span className="chip chip-neutral">
                  {view.next.min - view.estimate} to {view.next.label} ({view.next.min})
                </span>
              )}
            </div>
          </div>
          <p className="rounded-2xl bg-fill p-4 text-[14px] leading-relaxed text-muted-foreground">
            Based on your {view.anchor.bureau} score of{' '}
            <span className="tnum font-semibold text-foreground">{view.anchor.score}</span> from {fmtDate(view.anchor.reported_on)}
            {view.estimate !== view.anchor.score ? ', adjusted for how your habits have changed since' : ''}. {view.scale.note}.
            {Date.now() - new Date(view.anchor.reported_on).getTime() > 90 * 86_400_000 && (
              <span className="mt-1 block font-medium text-caution">It’s been over 3 months — add a fresh score to stay accurate.</span>
            )}
          </p>
          <div className="border-t border-hairline pt-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold">Your money habits</h3>
              <span className="tnum text-[14px] font-semibold">
                {view.rating}
                <span className="font-normal text-text-subtle"> /100 · {view.habits.label}</span>
              </span>
            </div>
            <FactorBreakdown factors={view.factors} />
          </div>
          <Recommendations factors={view.factors} />
        </>
      )}

      {history.length >= 2 && view.status !== 'insufficient' && (
        <div className="border-t border-hairline pt-5">
          <ScoreTimelineChart history={history} />
        </div>
      )}

      <div className="border-t border-hairline pt-5">
        <BureauScoreUpload scores={bureauScores} currentIndex={indexNow} factors={history.at(-1)?.factors ?? null} />
      </div>
      {bureauScores.length > 0 && view.status !== 'calibrated' && (
        <p className="-mt-2 text-[12.5px] text-muted-foreground">
          Your latest score ({bureauScores.at(-1)!.score} of {bureauScaleMax(bureauScores.at(-1)!)}) is saved — the estimate appears
          once your income and expenses are in.
        </p>
      )}
    </section>
  )
}
