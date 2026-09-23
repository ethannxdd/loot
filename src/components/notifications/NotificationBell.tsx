import { Link } from '@tanstack/react-router'
import { Bell, Check } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/useNotifications'
import type { AppNotification } from '@/lib/types'

const PANEL_WIDTH = 320 // w-80
const PANEL_MARGIN = 16 // matches max-w-[calc(100vw-2rem)] / the panel's old viewport clamp
const PANEL_GAP = 8 // vertical gap below the trigger, matches the old `top-11` offset under a 36px button

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * `align` is which edge of the bell the panel hangs from: "right" (default) opens leftwards, for a bell at the
 * right of a bar (mobile); "left" opens rightwards, for a bell at the left of the screen (desktop sidebar).
 */
export function NotificationBell({
  align = 'right',
  variant = 'plain',
}: {
  align?: 'left' | 'right'
  /** "plain" = borderless icon (sidebar); "button" = raised round icon button (mobile top bar). */
  variant?: 'plain' | 'button'
}) {
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read_at).length

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      // The panel is portaled to <body> (see below), so it's no longer a DOM descendant of the
      // trigger's own wrapper — a click inside it must not count as "outside" or the panel would
      // close itself before the click's own handler (mark-as-read, navigate) ever runs.
      if (ref.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // Portaled to <body> and positioned with `fixed` + a measured rect so no ancestor's `overflow: hidden`
  // (the sidebar, a card) can ever clip it — the same way the custom Select dropdown portals.
  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null)
      return
    }
    function updatePosition() {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2)
      const rawLeft = align === 'left' ? rect.left : rect.right - panelWidth
      const left = Math.min(Math.max(rawLeft, PANEL_MARGIN), window.innerWidth - panelWidth - PANEL_MARGIN)
      setPanelPos({ top: rect.bottom + PANEL_GAP, left })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    // Scrolling would leave a `fixed`-positioned panel floating away from its trigger since it no
    // longer tracks the trigger's position — closing on scroll is simpler and more predictable
    // than re-measuring on every scroll event, and matches how the click-outside close already works.
    function onScroll() {
      setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, align])

  function handleClick(n: AppNotification) {
    if (!n.read_at) markRead.mutate(n.id)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className={
          variant === 'button'
            ? 'icon-btn'
            : 'relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-fill-2 hover:text-foreground'
        }
      >
        <Bell size={variant === 'button' ? 18 : 17} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span
            className={`absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[9px] font-bold text-white ring-2 ring-[var(--surface)] ${
              variant === 'button' ? '-right-0.5 -top-0.5' : '-right-1 -top-1'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            ref={panelRef}
            className="animate-enter fixed z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-pop)]"
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <p className="text-[15px] font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
                >
                  <Check size={12} strokeWidth={2} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-text-muted">You're all caught up.</p>
              ) : (
                notifications.map((n) => {
                  const content = (
                    <div
                      className={`flex flex-col gap-0.5 border-b border-hairline px-4 py-3 last:border-0 ${
                        n.read_at ? '' : 'bg-primary/[0.06]'
                      } hover:bg-fill`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13.5px] font-semibold">{n.title}</p>
                        {!n.read_at && <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="text-[13px] text-muted-foreground">{n.body}</p>
                      <p className="text-[11.5px] text-text-subtle">{relativeTime(n.created_at)}</p>
                    </div>
                  )
                  return n.link ? (
                    <Link key={n.id} to={n.link} onClick={() => handleClick(n)}>
                      {content}
                    </Link>
                  ) : (
                    <button key={n.id} type="button" onClick={() => handleClick(n)} className="block w-full text-left">
                      {content}
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
