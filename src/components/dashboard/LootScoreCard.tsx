import { ChevronDown, Shield } from 'lucide-react'
import { useState } from 'react'
import { BureauScoreUpload } from '@/components/score/BureauScoreUpload'
import { FactorBreakdown } from '@/components/score/FactorBreakdown'
import { ScoreRing } from '@/components/score/ScoreRing'
import { ScoreTimelineChart } from '@/components/score/ScoreTimelineChart'
import { useBudgeScore } from '@/hooks/useBudgeScore'
import { useBureauScores } from '@/hooks/useBureauScores'
import { scoreColor, scoreRecommendations } from '@/lib/budge-score'

const COLOR_LABEL: Record<'green' | 'amber' | 'red', string> = {
  green: 'Healthy',
  amber: 'Fair',
  red: 'Needs attention',
}

export function LootScoreCard() {
  const { latest, previous, history, isLoading } = useBudgeScore()
  const { data: bureauScores = [] } = useBureauScores()
  const [expanded, setExpanded] = useState(false)

  if (isLoading) return <div className="skeleton h-40 rounded-2xl" />

  if (!latest) {
    return (
      <div className="card space-y-2">
        <div className="overline flex items-center gap-1.5">
          <Shield size={13} strokeWidth={2} /> Loot Score
        </div>
        <p className="text-sm text-muted-foreground">
          Add income and expenses to get your first Loot Score — a credit-health estimate based on your money habits.
        </p>
      </div>
    )
  }

  const color = scoreColor(latest.score)
  const delta = previous ? Math.round(latest.score - previous.score) : null
  const recommendations = scoreRecommendations(latest.factors)

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="overline flex items-center gap-1.5">
          <Shield size={13} strokeWidth={2} /> Loot Score
        </div>
        {delta !== null && delta !== 0 && (
          <span className={`text-xs font-semibold ${delta > 0 ? 'text-primary' : 'text-alert'}`}>
            {delta > 0 ? '+' : ''}
            {delta} vs last month
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <ScoreRing score={latest.score} />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold">{COLOR_LABEL[color]}</p>
          <p className="text-xs text-muted-foreground">
            A local estimate of your credit health, from your income, spending, and debt patterns — not a real
            bureau score.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
      >
        {expanded ? 'Hide details' : 'View factors & recommendations'}
        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="animate-enter space-y-5 border-t border-hairline pt-4">
          <FactorBreakdown factors={latest.factors} />

          {recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="overline">Recommendations</p>
              <ul className="space-y-1.5">
                {recommendations.map((r) => (
                  <li key={r.factor} className="text-xs leading-relaxed text-muted-foreground">
                    {r.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ScoreTimelineChart history={history} bureauScores={bureauScores} />

          <BureauScoreUpload scores={bureauScores} estimatedScore={latest.score} factors={latest.factors} />
        </div>
      )}
    </div>
  )
}
