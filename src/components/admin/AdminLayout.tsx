import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, ChevronRight, Flag, LayoutGrid, Loader2, LogOut, Menu, ScrollText, ShieldCheck, Users, X, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AdminTwoFactor } from '@/components/admin/AdminTwoFactor'
import { Glass, LiquidGlassDefs } from '@/components/ui/Glass'
import { Logo } from '@/components/ui/Logo'
import { useAdminMe, useAdminOverview } from '@/hooks/useAdmin'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { ROLE_LABEL, roleAtLeast, type AdminRole } from '@/lib/admin'
import { initials } from '@/lib/utils'

interface AdminNavItem {
  to: '/admin' | '/admin/users' | '/admin/team' | '/admin/flags' | '/admin/audit'
  label: string
  short: string
  icon: LucideIcon
  min: AdminRole
}

const GROUPS: { label: string; items: AdminNavItem[] }[] = [
  { label: 'Insights', items: [{ to: '/admin', label: 'Overview', short: 'Overview', icon: LayoutGrid, min: 'viewer' }] },
  {
    label: 'People',
    items: [
      { to: '/admin/users', label: 'Users', short: 'Users', icon: Users, min: 'viewer' },
      { to: '/admin/team', label: 'Team', short: 'Team', icon: ShieldCheck, min: 'owner' },
    ],
  },
  {
    label: 'Controls',
    items: [
      { to: '/admin/flags', label: 'Feature flags', short: 'Flags', icon: Flag, min: 'viewer' },
      { to: '/admin/audit', label: 'Audit log', short: 'Audit', icon: ScrollText, min: 'viewer' },
    ],
  },
]

const TABS: AdminNavItem[] = [GROUPS[0].items[0], GROUPS[1].items[0], GROUPS[2].items[0], GROUPS[2].items[1]]

function isActive(pathname: string, to: string) {
  return to === '/admin' ? pathname === '/admin' || pathname === '/admin/' : pathname === to || pathname.startsWith(`${to}/`)
}

function AdminBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`rounded-full bg-ink font-bold tracking-[0.04em] text-ink-foreground uppercase ${
        small ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      Admin
    </span>
  )
}

/** How many accounts need a look (badge on Users). Uses the cached 30-day overview. */
function useAttentionCount() {
  const { data } = useAdminOverview(30)
  if (!data) return 0
  return data.attention.unconfirmed + data.attention.stuck + data.attention.suspended
}

function AdminSidebar({ role }: { role: AdminRole }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const reduceMotion = useReducedMotion()
  const attention = useAttentionCount()

  return (
    <aside className="sticky top-0 z-20 hidden h-dvh w-[256px] shrink-0 p-3 md:block">
      <Glass className="flex h-full flex-col gap-5 rounded-[26px] px-3 py-4">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <Link to="/admin" className="flex items-center gap-2.5" aria-label="Loot admin — Overview">
            <Logo size={30} />
            <span className="text-[17px] font-bold tracking-[-0.02em]">Loot</span>
          </Link>
          <span className="ml-auto">
            <AdminBadge />
          </span>
        </div>

        <nav className="-mx-1 flex-1 space-y-5 overflow-y-auto px-1" aria-label="Admin">
          {GROUPS.map((g) => {
            const items = g.items.filter((i) => roleAtLeast(role, i.min))
            if (!items.length) return null
            return (
              <div key={g.label}>
                <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-text-subtle">{g.label}</div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const on = isActive(pathname, item.to)
                    const Icon = item.icon
                    return (
                      <Link key={item.to} to={item.to} aria-current={on ? 'page' : undefined} className={`nav-item relative ${on ? 'nav-item-active' : ''}`}>
                        {on && (
                          <motion.span
                            layoutId="admin-droplet"
                            aria-hidden
                            className="glass-droplet absolute inset-0 rounded-[11px]"
                            transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.2, duration: 0.45 }}
                          />
                        )}
                        <Icon size={17} strokeWidth={on ? 2.1 : 1.8} className="relative shrink-0" />
                        <span className="relative truncate">{item.label}</span>
                        {item.to === '/admin/users' && attention > 0 && (
                          <span className="tnum relative ml-auto rounded-full bg-caution/15 px-1.5 text-[11px] font-semibold text-caution" title="Accounts that need attention">
                            {attention}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <Link to="/dashboard" className="nav-item text-muted-foreground">
          <ArrowLeft size={17} strokeWidth={1.8} />
          Back to my Loot
        </Link>

        <div className="flex items-center gap-2.5 rounded-2xl bg-fill p-2">
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8e8cf0] to-[#5e5ce6] text-xs font-semibold text-white">
            {initials(profile?.display_name, user?.email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{profile?.display_name || user?.email}</span>
            <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
              {ROLE_LABEL[role]} · <ShieldCheck size={11} className="text-primary" /> 2FA on
            </span>
          </span>
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

function AdminMobileMenu({ role }: { role: AdminRole }) {
  const [open, setOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { user, signOut } = useAuth()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const items = GROUPS.flatMap((g) => g.items).filter((i) => roleAtLeast(role, i.min))

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu" className="grid h-9 w-9 place-items-center rounded-full bg-fill">
        <Menu size={17} />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] md:hidden">
            <div className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
            <nav
              role="dialog"
              aria-modal="true"
              aria-label="Admin menu"
              className="mobile-menu-sheet absolute inset-y-0 right-0 flex w-[min(86vw,360px)] flex-col text-foreground"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: 'env(safe-area-inset-top)' }}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <span className="flex items-center gap-2 text-[22px] font-bold tracking-[-0.025em]">
                  Admin <AdminBadge small />
                </span>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full bg-fill">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto px-4 pt-2 pb-4">
                <p className="px-1 text-[13px] text-muted-foreground">
                  {user?.email} · {ROLE_LABEL[role]}
                </p>
                <div className="overflow-hidden rounded-2xl bg-surface">
                  {items.map((item, i) => {
                    const Icon = item.icon
                    const on = isActive(pathname, item.to)
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`flex min-h-[50px] items-center gap-3 px-3.5 text-[16px] ${i > 0 ? 'border-t border-hairline' : ''} ${on ? 'font-semibold text-primary' : 'font-medium'}`}
                      >
                        <span className={`grid h-8 w-8 place-items-center rounded-[9px] ${on ? 'bg-[var(--accent-tint)] text-primary' : 'bg-fill'}`}>
                          <Icon size={17} />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight size={16} className="text-text-subtle" />
                      </Link>
                    )
                  })}
                </div>
                <div className="overflow-hidden rounded-2xl bg-surface">
                  <Link to="/dashboard" className="flex min-h-[50px] items-center gap-3 px-3.5 text-[16px] font-medium">
                    <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-fill">
                      <ArrowLeft size={17} />
                    </span>
                    Back to my Loot
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex min-h-[50px] w-full items-center gap-3 border-t border-hairline px-3.5 text-[16px] font-medium text-alert"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-fill">
                      <LogOut size={17} />
                    </span>
                    Sign out
                  </button>
                </div>
              </div>
            </nav>
          </div>,
          document.body,
        )}
    </>
  )
}

function AdminTopBar({ role }: { role: AdminRole }) {
  return (
    <header
      className="topbar-material sticky top-0 z-30 flex items-center gap-2.5 px-4 md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(52px + env(safe-area-inset-top))' }}
    >
      <Link to="/admin" className="flex items-center gap-2.5" aria-label="Loot admin — Overview">
        <Logo size={26} />
        <span className="text-[16px] font-bold tracking-[-0.02em]">Loot</span>
      </Link>
      <AdminBadge small />
      <div className="ml-auto">
        <AdminMobileMenu role={role} />
      </div>
    </header>
  )
}

function AdminTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const reduceMotion = useReducedMotion()
  return (
    <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center md:hidden" style={{ bottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
      <Glass as="nav" aria-label="Admin" className="pointer-events-auto flex gap-1 rounded-full p-1.5">
        {TABS.map((t) => {
          const on = isActive(pathname, t.to)
          const Icon = t.icon
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={on ? 'page' : undefined}
              className={`relative flex w-[76px] flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-semibold ${on ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {on && (
                <motion.span
                  layoutId="admin-tab-droplet"
                  aria-hidden
                  className="glass-droplet absolute inset-0 rounded-full"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.22, duration: 0.45 }}
                />
              )}
              <Icon size={20} className="relative" strokeWidth={on ? 2.2 : 1.8} />
              <span className="relative">{t.short}</span>
            </Link>
          )
        })}
      </Glass>
    </div>
  )
}

/**
 * The /admin shell. The route guard has already checked there's an admin role; here we insist on a
 * two-factor session before showing anything (the database refuses admin calls without one anyway).
 */
export function AdminLayout() {
  const { data: me, isLoading } = useAdminMe()

  if (isLoading || !me) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!me.role) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-[20px] font-bold">You’re not on the admin team</p>
        <Link to="/dashboard" className="btn btn-primary">
          Back to my Loot
        </Link>
      </div>
    )
  }
  if (me.aal !== 'aal2') return <AdminTwoFactor />

  return (
    <div className="relative flex min-h-dvh" data-testid="admin-shell">
      <LiquidGlassDefs />
      <div className="app-ambient" aria-hidden />
      <AdminSidebar role={me.role} />
      <div className="relative z-[1] flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-clip">
        <AdminTopBar role={me.role} />
        <main className="flex-1 px-4 pt-3 pb-[calc(96px+env(safe-area-inset-bottom))] md:px-10 md:pt-8 md:pb-12">
          <div className="mx-auto w-full max-w-[1180px]">
            <Outlet />
          </div>
        </main>
        <AdminTabBar />
      </div>
    </div>
  )
}
