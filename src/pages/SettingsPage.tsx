import type { ReactNode } from 'react'
import { LootScoreSection } from '@/components/score/LootScoreSection'
import { PageHeader } from '@/components/ui/PageHeader'
import { AppearanceSection } from '@/components/settings/AppearanceSection'
import { DataSection } from '@/components/settings/DataSection'
import { FinancialIdentitySection } from '@/components/settings/FinancialIdentitySection'
import { HelpSection } from '@/components/settings/HelpSection'
import { HouseholdSection } from '@/components/settings/HouseholdSection'
import { IncomeSection } from '@/components/settings/IncomeSection'
import { PreferencesSection } from '@/components/settings/PreferencesSection'
import { ProfileSection } from '@/components/settings/ProfileSection'
import { useProfile } from '@/hooks/useProfile'

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="px-1 text-[13px] font-semibold tracking-[0.01em] text-muted-foreground uppercase">{label}</h2>
      {children}
    </div>
  )
}

export function SettingsPage() {
  const { data: profile, isLoading } = useProfile()

  return (
    <div className="animate-enter mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Account" title="Settings" subtitle="Your profile, income, preferences and data." />

      {isLoading || !profile ? (
        <div className="space-y-4">
          <div className="skeleton h-64 rounded-[22px]" />
          <div className="skeleton h-48 rounded-[22px]" />
        </div>
      ) : (
        <>
          <Group label="You">
            <ProfileSection profile={profile} />
            <AppearanceSection />
          </Group>
          <Group label="Money">
            <IncomeSection profile={profile} />
            <PreferencesSection profile={profile} />
          </Group>
        </>
      )}

      <Group label="People">
        <HouseholdSection />
      </Group>

      <Group label="Insights">
        <LootScoreSection />
        <FinancialIdentitySection />
      </Group>

      <Group label="Support">
        <HelpSection />
        <DataSection />
      </Group>
    </div>
  )
}
