import { Outlet } from '@tanstack/react-router'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { TutorialAutoStart } from '@/components/tutorial/TutorialAutoStart'
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay'
import { TutorialProvider } from '@/context/TutorialContext'
import { MobileTabBar } from './MobileTabBar'
import { MobileTopBar } from './MobileTopBar'
import { Sidebar } from './Sidebar'

// Loot Assistant is parked (Ethan's call, Sept 2026) — built and deployed, just not linked
// into the UI right now. AssistantFab, the /assistant route, and its tutorial step are all
// disconnected below rather than deleted, so re-enabling it later is a small, easy diff:
// re-add the `<AssistantFab />` line, restore src/routes/_app/assistant.tsx's `component`,
// and re-add the "assistant" step to src/lib/tutorial-steps.ts. See LOOT-BUILD-LOG.md.

export function AppLayout() {
  return (
    <TutorialProvider>
      <div className="flex min-h-dvh">
        <NotificationCenter />
        <TutorialAutoStart />
        <Sidebar />
        <div className="loot-gradient flex min-h-dvh flex-1 flex-col">
          <MobileTopBar />
          <main className="flex-1 px-5 pt-6 pb-[calc(56px+env(safe-area-inset-bottom)+24px)] md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-6xl">
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
