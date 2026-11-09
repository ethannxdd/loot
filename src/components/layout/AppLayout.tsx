import { Outlet } from '@tanstack/react-router'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { TutorialAutoStart } from '@/components/tutorial/TutorialAutoStart'
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay'
import { LiquidGlassDefs } from '@/components/ui/Glass'
import { LogSpendSheet } from '@/components/spending/LogSpendSheet'
import { LogSpendUrlOpener } from '@/components/spending/LogSpendUrlOpener'
import { LogSpendProvider } from '@/context/LogSpendContext'
import { TutorialProvider } from '@/context/TutorialContext'
import { useFeature } from '@/hooks/useFeatures'
import { useContent } from '@/hooks/useContent'
import { useProfile } from '@/hooks/useProfile'
import { publishedTaxTables } from '@/lib/content'
import { setPublishedTaxTables } from '@/lib/tax/tax-tables'
import { setActiveCurrency } from '@/lib/utils'
import { AccountGuard } from './AccountGuard'
import { AssistantFab } from './AssistantFab'
import { Sidebar } from './Sidebar'
import { MobileTabBar } from './MobileTabBar'
import { MobileTopBar } from './MobileTopBar'
import { PushClickTracker } from './PushClickTracker'
import { GoalMaintenance } from './GoalMaintenance'
import { SnapshotKeeper } from './SnapshotKeeper'

// Ask Loot is behind the `assistant` feature flag (Admin → Feature flags): off for everyone by default, switchable per
// person or for everyone without a deploy. Its tutorial step only shows with the flag on (tutorial-steps.ts).

export function AppLayout() {
  const { data: profile } = useProfile()
  const assistant = useFeature('assistant')
  // Every formatCurrency() call follows the user's chosen currency. Set during render (before children
  // render) and used as a key below so a currency change re-renders all figures immediately.
  setActiveCurrency(profile?.currency_code)
  // SARS tables published in the Content manager (Phase 6 D11) replace the bundled ones; invalid ones are ignored.
  const content = useContent()
  setPublishedTaxTables(publishedTaxTables(content.raw))

  return (
    <AccountGuard>
      <TutorialProvider>
        <LogSpendProvider>
          <div className="relative flex min-h-dvh">
            <LiquidGlassDefs />
            <div className="app-ambient" aria-hidden />
            <SnapshotKeeper />
            <GoalMaintenance />
            <NotificationCenter />
            <TutorialAutoStart />
            <Sidebar />
            <div className="relative z-[1] flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-clip">
              <MobileTopBar />
              <main className="flex-1 px-4 pt-3 pb-[calc(96px+env(safe-area-inset-bottom))] md:px-10 md:pt-8 md:pb-12">
                <div key={profile?.currency_code} className="mx-auto w-full max-w-[1180px]">
                  <Outlet />
                </div>
              </main>
              <MobileTabBar />
            </div>
            {assistant && <AssistantFab />}
            <LogSpendSheet />
            <LogSpendUrlOpener />
            <PushClickTracker />
            <TutorialOverlay />
          </div>
        </LogSpendProvider>
      </TutorialProvider>
    </AccountGuard>
  )
}
