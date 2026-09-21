import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Logo } from '@/components/ui/Logo'
import { MobileMenu } from './MobileMenu'

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-hairline bg-background/90 px-4 backdrop-blur-xl md:hidden">
      <Logo size={22} />
      <span className="text-sm font-bold">Loot</span>
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <MobileMenu />
      </div>
    </header>
  )
}
