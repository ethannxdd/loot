import { Link, useRouterState } from '@tanstack/react-router'
import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { isActivePath, NAV_GROUPS } from '@/lib/nav'

/**
 * Full navigation for phones. The bottom bar only has room for five tabs, so Checker, Planner,
 * Compare Plans, Tax Centre and Settings (and Sign out) live here — nothing is unreachable on mobile.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Close whenever the route changes, and on Escape.
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        >
          <nav
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            className="animate-enter absolute inset-y-0 right-0 flex w-[min(88vw,340px)] flex-col border-l border-hairline bg-background"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <span className="min-w-0 truncate text-xs text-text-muted">{user?.email}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="overline mb-1.5 px-3">{group.label}</div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = isActivePath(pathname, item.to)
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
                          }`}
                        >
                          <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-hairline p-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  void signOut()
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                <LogOut size={18} strokeWidth={1.75} />
                Sign out
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
