import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronRight, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAdminMe } from '@/hooks/useAdmin'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { isActivePath, NAV_GROUPS } from '@/lib/nav'
import { initials } from '@/lib/utils'

/**
 * Full navigation for phones. The bottom bar only has room for five tabs, so Checker, Planner,
 * Compare Plans, Tax Centre and Settings (and Sign out) live here — nothing is unreachable on mobile.
 *
 * The sheet is portalled to <body>: the top bar uses `backdrop-filter`, which makes it the containing block
 * for `position: fixed` children — rendered inside it, the sheet was clipped to the 52px header.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const reduceMotion = useReducedMotion()
  const { data: adminMe } = useAdminMe()
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Close whenever the route changes.
  useEffect(() => setOpen(false), [pathname])

  // Escape closes; the page underneath doesn't scroll while the sheet is open; focus moves into the sheet and back.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const trigger = triggerRef.current
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      trigger?.focus({ preventScroll: true })
    }
  }, [open])

  const settingsActive = isActivePath(pathname, '/settings')
  const groups = NAV_GROUPS.filter((g) => g.items.some((i) => i.to !== '/settings'))
    .map((g) => ({ ...g, items: g.items.filter((i) => i.to !== '/settings') }))

  const sheet = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" data-testid="mobile-menu">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          />
          <motion.nav
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            className="mobile-menu-sheet absolute inset-y-0 right-0 flex w-[min(86vw,360px)] flex-col text-foreground"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: 'env(safe-area-inset-top)' }}
            initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: '100%', transition: { duration: 0.24, ease: [0.32, 0.72, 0, 1] } }}
            transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 420, damping: 40 }}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <span className="text-[22px] font-bold tracking-[-0.025em]">Menu</span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-foreground"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
              {/* Account → Settings */}
              <Link
                to="/settings"
                className={`flex items-center gap-3 rounded-2xl p-3 ${settingsActive ? 'bg-[var(--accent-tint)]' : 'bg-surface'}`}
                aria-label="Settings"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8e8cf0] to-[#5e5ce6] text-[15px] font-semibold text-white">
                  {initials(profile?.display_name, user?.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{profile?.display_name || 'Your account'}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{user?.email}</span>
                  <span className="block text-[13px] font-semibold text-primary">Settings</span>
                </span>
                <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-text-subtle" />
              </Link>

              {groups.map((group) => (
                <div key={group.label}>
                  <div className="mb-1.5 px-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {group.label}
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-surface">
                    {group.items.map((item, i) => {
                      const isActive = isActivePath(pathname, item.to)
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex min-h-[50px] items-center gap-3 px-3.5 text-[16px] ${
                            i > 0 ? 'border-t border-hairline' : ''
                          } ${isActive ? 'font-semibold text-primary' : 'font-medium text-foreground active:bg-fill'}`}
                        >
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] ${
                              isActive ? 'bg-[var(--accent-tint)] text-primary' : 'bg-fill text-foreground'
                            }`}
                          >
                            <Icon size={17} strokeWidth={isActive ? 2.25 : 1.9} />
                          </span>
                          <span className="flex-1">{item.label}</span>
                          <ChevronRight size={16} strokeWidth={2} className="text-text-subtle" />
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}

              {adminMe?.role && (
                <div>
                  <div className="mb-1.5 px-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Admin</div>
                  <Link
                    to="/admin"
                    className="flex min-h-[50px] items-center gap-3 overflow-hidden rounded-2xl bg-surface px-3.5 text-[16px] font-medium text-foreground active:bg-fill"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-ink text-ink-foreground">
                      <ShieldCheck size={17} strokeWidth={2} />
                    </span>
                    <span className="flex-1">Admin portal</span>
                    <ChevronRight size={16} strokeWidth={2} className="text-text-subtle" />
                  </Link>
                </div>
              )}
            </div>

            <div className="border-t border-hairline px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  void signOut()
                }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface text-[16px] font-semibold text-alert active:bg-fill"
              >
                <LogOut size={18} strokeWidth={2} />
                Sign out
              </button>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="icon-btn"
      >
        <Menu size={19} strokeWidth={1.9} />
      </button>
      {typeof document !== 'undefined' && createPortal(sheet, document.body)}
    </>
  )
}
