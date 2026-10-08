import { Outlet } from '@tanstack/react-router'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { TutorialAutoStart } from '@/components/tutorial/TutorialAutoStart'
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay'
import { LiquidGlassDefs } from '@/components/ui/Glass'
import { TutorialProvider } from '@/context/TutorialContext'
import { useFeature } from '@/hooks/useFeatures'
import { useProfile } from '@/hooks/useProfile'
import { setActiveCurrency } from '@/lib/utils'
import { AccountGuard } from './AccountGuard'
import { AssistantFab } from './AssistantFab'
import { Sidebar } from './Sidebar'
import { MobileTabBar } from './MobileTabBar'
import { MobileTopBar } from './MobileTopBar'
import { GoalMaintenance } from './GoalMaintenance'
import { SnapshotKeeper } from './SnapshotKeeper'

// Loot Assistant is behind the `assistant` feature flag (Admin → Feature flags) since Oct 2026: off for
// everyone by default, switchable per person or for everyone without a deploy. Its tutorial step is still
// out of tutorial-steps.ts; add it back when the flag goes on for everyone.

export function AppLayout() {
  const { data: profile } = useProfile()
  const assistant = useFeature('assistant')
  // Every formatCurrency() call follows the user's chosen currency. Set during render (before children
  // render) and used as a key below so a currency change re-renders all figures immediately.
  setActiveCurrency(profile?.currency_code)

  return (
    <AccountGuard>
      <TutorialProvider>
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
          <TutorialOverlay />
        </div>
      </TutorialProvider>
    </AccountGuard>
  )
}
