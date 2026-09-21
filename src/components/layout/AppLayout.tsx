import { Outlet } from '@tanstack/react-router'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { TutorialAutoStart } from '@/components/tutorial/TutorialAutoStart'
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay'
import { TutorialProvider } from '@/context/TutorialContext'
import { useProfile } from '@/hooks/useProfile'
import { setActiveCurrency } from '@/lib/utils'
import { MobileTabBar } from './MobileTabBar'
import { MobileTopBar } from './MobileTopBar'
import { Sidebar } from './Sidebar'
import { GoalMaintenance } from './GoalMaintenance'
import { SnapshotKeeper } from './SnapshotKeeper'

// Loot Assistant is parked (Ethan's call, Sept 2026) — built and deployed, just not linked
// into the UI right now. AssistantFab, the /assistant route, and its tutorial step are all
// disconnected below rather than deleted, so re-enabling it later is a small, easy diff:
// re-add the `<AssistantFab />` line, restore src/routes/_app/assistant.tsx's `component`,
// and re-add the "assistant" step to src/lib/tutorial-steps.ts. See LOOT-BUILD-LOG.md.

export function AppLayout() {
  const { data: profile } = useProfile()
  // Every formatCurrency() call follows the user's chosen currency. Set during render (before children
  // render) and used as a key below so a currency change re-renders all figures immediately.
  setActiveCurrency(profile?.currency_code)

  return (
    <TutorialProvider>
      <div className="flex min-h-dvh">
        <SnapshotKeeper />
        <GoalMaintenance />
        <NotificationCenter />
        <TutorialAutoStart />
        <Sidebar />
        <div className="loot-gradient flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-clip">
          <MobileTopBar />
          <main className="flex-1 px-5 pt-6 pb-[calc(56px+env(safe-area-inset-bottom)+24px)] md:px-8 md:py-8">
            <div key={profile?.currency_code} className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </main>
          <MobileTabBar />
        </div>
        <TutorialOverlay />
      </div>
    </TutorialProvider>
  )
}
