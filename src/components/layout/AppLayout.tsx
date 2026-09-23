import { Outlet } from '@tanstack/react-router'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { TutorialAutoStart } from '@/components/tutorial/TutorialAutoStart'
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay'
import { LiquidGlassDefs } from '@/components/ui/Glass'
import { TutorialProvider } from '@/context/TutorialContext'
import { useProfile } from '@/hooks/useProfile'
import { setActiveCurrency } from '@/lib/utils'
import { Sidebar } from './Sidebar'
import { MobileTabBar } from './MobileTabBar'
import { MobileTopBar } from './MobileTopBar'
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
        <TutorialOverlay />
      </div>
    </TutorialProvider>
  )
}
