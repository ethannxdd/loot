import { Link, useRouterState } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Glass } from '@/components/ui/Glass'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { isActivePath, NAV_GROUPS } from '@/lib/nav'
import { initials } from '@/lib/utils'

/**
 * Desktop navigation — a macOS-style source-list sidebar (v2 "Wallet" design). Always labelled,
 * so there's nothing to hover to discover (the old hover-to-expand rail caused misclicks). Settings
 * lives in the account row at the bottom, like macOS apps. Mobile uses MobileTabBar + MobileMenu.
 */
export function Sidebar() {
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const settingsActive = isActivePath(pathname, '/settings')
  const reduceMotion = useReducedMotion()

  return (
    <aside className="sticky top-0 z-20 hidden h-dvh w-[256px] shrink-0 p-3 md:block">
      <Glass className="flex h-full flex-col gap-5 rounded-[26px] px-3 py-4">
      <div className="flex items-center gap-2 px-1">
        <Link to="/dashboard" className="flex items-center gap-2.5 rounded-xl px-1 py-1" aria-label="Loot — go to Summary">
          <Logo size={30} />
          <span className="text-[17px] font-bold tracking-[-0.02em]">Loot</span>
        </Link>
        <div className="ml-auto">
          <NotificationBell align="left" />
        </div>
      </div>

      <nav className="-mx-1 flex-1 space-y-5 overflow-y-auto px-1" aria-label="Main">
        {NAV_GROUPS.filter((g) => g.label !== 'Other').map((group) => (
          <div key={group.label}>
            <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-text-subtle">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isActivePath(pathname, item.to)
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={isActive ? 'page' : undefined}
                    className={`nav-item relative ${isActive ? 'nav-item-active' : ''}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-droplet"
                        aria-hidden
                        className="glass-droplet absolute inset-0 rounded-[11px]"
                        transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.2, duration: 0.45 }}
                      />
                    )}
                    <Icon size={17} strokeWidth={isActive ? 2.1 : 1.8} className="relative shrink-0" />
                    <span className="relative truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={`flex items-center gap-2.5 rounded-2xl p-2 ${settingsActive ? 'glass-droplet' : 'bg-fill'}`}
      >
        <Link to="/settings" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="Settings">
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8e8cf0] to-[#5e5ce6] text-xs font-semibold text-white">
            {initials(profile?.display_name, user?.email)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{profile?.display_name || user?.email}</span>
            <span className={`block text-[11.5px] ${settingsActive ? 'text-primary' : 'text-muted-foreground'}`}>
              Settings · {profile?.currency_code ?? 'ZAR'}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Sign out"
          title="Sign out"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-subtle hover:bg-fill-2 hover:text-foreground"
        >
          <LogOut size={16} strokeWidth={1.8} />
        </button>
      </div>
      </Glass>
    </aside>
  )
}
