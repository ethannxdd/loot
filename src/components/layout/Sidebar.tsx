import { Link, useRouterState } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/hooks/useAuth'
import { NAV_GROUPS } from '@/lib/nav'

export function Sidebar() {
  const { signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-hairline bg-background md:flex">
      <div className="flex items-center justify-between gap-2.5 px-5 py-6">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-base font-bold">Loot</span>
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="overline mb-1.5 px-3">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.to
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
                    }`}
                  >
                    <Icon size={17} strokeWidth={isActive ? 2.25 : 1.75} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-hairline p-3">
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          <LogOut size={17} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
