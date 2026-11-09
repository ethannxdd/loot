import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Logo } from '@/components/ui/Logo'
import { useLogSpendSheet } from '@/context/LogSpendContext'
import { useFeature } from '@/hooks/useFeatures'
import { MobileMenu } from './MobileMenu'

/** Compact mobile header — brand, notifications, and the full menu. Page titles live in the page (large title). */
export function MobileTopBar() {
  const live = useFeature('live_cycle')
  const { openLog } = useLogSpendSheet()
  return (
    <header
      className="topbar-material sticky top-0 z-30 flex items-center gap-2.5 px-4 md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(52px + env(safe-area-inset-top))' }}
    >
      <Link to="/dashboard" className="flex items-center gap-2.5 rounded-full py-1 pr-2" aria-label="Loot — go to Summary">
        <Logo size={26} />
        <span className="text-[16px] font-bold tracking-[-0.02em]">Loot</span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        {live && (
          <button
            type="button"
            onClick={() => openLog()}
            className="btn btn-primary !min-h-9 !gap-1 !px-3 !text-[14px]"
            aria-label="Log a spend"
            data-testid="topbar-log"
          >
            <Plus size={16} strokeWidth={2.4} />
            Log
          </button>
        )}
        <NotificationBell variant="button" />
        <MobileMenu />
      </div>
    </header>
  )
}
