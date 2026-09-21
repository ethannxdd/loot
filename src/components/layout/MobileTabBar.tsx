import { Link, useRouterState } from '@tanstack/react-router'
import { isActivePath, MOBILE_TABS } from '@/lib/nav'

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(56px+env(safe-area-inset-bottom))] items-start border-t border-hairline bg-background/92 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-14 flex-1 items-center justify-around">
        {MOBILE_TABS.map((item) => {
          const isActive = isActivePath(pathname, item.to)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-semibold ${
                isActive ? 'text-primary' : 'text-text-muted'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
