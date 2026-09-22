import { Link, useRouterState } from '@tanstack/react-router'
import { LogOut, PanelLeft } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/hooks/useAuth'
import { isActivePath, NAV_GROUPS } from '@/lib/nav'

const PIN_STORAGE_KEY = 'loot:rail-pinned'
const COLLAPSED_WIDTH = 84
const EXPANDED_WIDTH = 260

function readStoredPin(): boolean {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Desktop nav rail. Collapsed to icons by default; hovering (or focusing into it with the
 * keyboard) expands it to icon+label for as long as the pointer/focus stays inside, and the
 * pin button keeps it expanded permanently until pinned again. Mobile nav (MobileTabBar /
 * MobileMenu) is untouched — this only ever renders at the md breakpoint and up.
 */
export function CollapsibleRail() {
  const { signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [pinned, setPinned] = useState(readStoredPin)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const expanded = pinned || hovering || focused

  useEffect(() => {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, pinned ? '1' : '0')
    } catch {
      /* storage unavailable — pin just won't persist across reloads */
    }
  }, [pinned])

  const labelClass = (extra = '') => `rail-label ${expanded ? 'rail-label-visible' : ''} ${extra}`.trim()

  return (
    <motion.aside
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false)
      }}
      animate={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.32 }}
      className="rail-shell hidden shrink-0 flex-col md:flex"
    >
      <div className="rail-glass" aria-hidden="true" />

      <div className="relative z-10 flex h-full flex-col gap-1 px-3 py-5">
        <div className="mb-1 flex items-center px-1 pb-4">
          <Logo size={32} className="shrink-0" />
          <span className={labelClass('text-base font-bold')}>Loot</span>
          <div className={`ml-auto ${expanded ? 'opacity-100' : 'pointer-events-none opacity-0'} transition-opacity`}>
            <NotificationBell align="left" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          aria-pressed={pinned}
          aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          className="rail-item mb-2 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
        >
          <PanelLeft size={18} strokeWidth={1.75} className={`shrink-0 ${pinned ? 'text-primary' : ''}`} />
          <span className={labelClass()}>{pinned ? 'Pinned open' : 'Pin open'}</span>
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.label}>
              {i > 0 && <div className="rail-divider" />}
              {expanded && <div className="overline mb-1 px-3">{group.label}</div>}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = isActivePath(pathname, item.to)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`rail-item ${
                        isActive
                          ? 'rail-item-active'
                          : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
                      }`}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} className="shrink-0" />
                      <span className={labelClass()}>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="rail-divider" />
        <button
          type="button"
          onClick={() => signOut()}
          className="rail-item text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
        >
          <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
          <span className={labelClass()}>Sign out</span>
        </button>
      </div>
    </motion.aside>
  )
}
