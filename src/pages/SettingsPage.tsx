import { Shield } from 'lucide-react'
import { BureauScoreUpload } from '@/components/score/BureauScoreUpload'
import { FactorBreakdown } from '@/components/score/FactorBreakdown'
import { ScoreRing } from '@/components/score/ScoreRing'
import { ScoreTimelineChart } from '@/components/score/ScoreTimelineChart'
import { DataSection } from '@/components/settings/DataSection'
import { FinancialIdentitySection } from '@/components/settings/FinancialIdentitySection'
import { HelpSection } from '@/components/settings/HelpSection'
import { HouseholdSection } from '@/components/settings/HouseholdSection'
import { IncomeSection } from '@/components/settings/IncomeSection'
import { PreferencesSection } from '@/components/settings/PreferencesSection'
import { ProfileSection } from '@/components/settings/ProfileSection'
import { useBudgeScore } from '@/hooks/useBudgeScore'
import { useBureauScores } from '@/hooks/useBureauScores'
import { useProfile } from '@/hooks/useProfile'
import { scoreColor, scoreRecommendations } from '@/lib/budge-score'

const COLOR_LABEL: Record<'green' | 'amber' | 'red', string> = {
  green: 'Healthy',
  amber: 'Fair',
  red: 'Needs attention',
}

function LootScoreSection() {
  const { latest, previous, history, isLoading } = useBudgeScore()
  const { data: bureauScores = [] } = useBureauScores()

  if (isLoading) return <div className="skeleton h-48 rounded-2xl" />

  return (
    <section className="card space-y-5">
      <div className="overline-label flex items-center gap-1.5">
        <Shield size={13} strokeWidth={2} /> Loot Score
      </div>

      {!latest ? (
        <p className="text-sm text-muted-foreground">
          Add income and expenses to get your first Loot Score — a credit-health estimate based on your money
          habits.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <ScoreRing score={latest.score} size={96} />
            <div className="space-y-1">
              <p className="text-sm font-bold">{COLOR_LABEL[scoreColor(latest.score)]}</p>
              {previous && latest.score !== previous.score && (
                <p className={`text-xs font-semibold ${latest.score > previous.score ? 'text-primary' : 'text-alert'}`}>
                  {latest.score > previous.score ? '+' : ''}
                  {Math.round(latest.score - previous.score)} vs last month
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                A local estimate, not a real bureau score — see below to compare against one.
              </p>
            </div>
          </div>

          <div className="border-t border-hairline pt-4">
            <p className="overline-label mb-3">Factors</p>
            <FactorBreakdown factors={latest.factors} />
          </div>

          {scoreRecommendations(latest.factors).length > 0 && (
            <div className="border-t border-hairline pt-4">
              <p className="overline-label mb-2">Recommendations</p>
              <ul className="space-y-1.5">
                {scoreRecommendations(latest.factors).map((r) => (
                  <li key={r.factor} className="text-xs leading-relaxed text-muted-foreground">
                    {r.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-hairline pt-4">
            <ScoreTimelineChart history={history} bureauScores={bureauScores} />
          </div>
        </>
      )}

      <div className="border-t border-hairline pt-4">
        <BureauScoreUpload scores={bureauScores} estimatedScore={latest?.score ?? null} factors={latest?.factors ?? null} />
      </div>
    </section>
  )
}

export function SettingsPage() {
  const { data: profile, isLoading } = useProfile()

  return (
    <div className="animate-enter max-w-2xl space-y-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-[-0.025em]">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your profile, income, preferences and data.</p>
      </header>

      {isLoading || !profile ? (
        <div className="space-y-4">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      ) : (
        <>
          <ProfileSection profile={profile} />
          <IncomeSection profile={profile} />
          <PreferencesSection profile={profile} />
        </>
      )}

      <HouseholdSection />

      <FinancialIdentitySection />

      <LootScoreSection />

      <HelpSection />

      <DataSection />
    </div>
  )
}
