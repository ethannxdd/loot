import { Link } from '@tanstack/react-router'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Logo } from '@/components/ui/Logo'
import { MobileMenu } from './MobileMenu'

/** Compact mobile header — brand, notifications, and the full menu. Page titles live in the page (large title). */
export function MobileTopBar() {
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
        <NotificationBell variant="button" />
        <MobileMenu />
      </div>
    </header>
  )
}
