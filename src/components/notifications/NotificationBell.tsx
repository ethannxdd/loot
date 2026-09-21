import { Link } from '@tanstack/react-router'
import { Bell, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/useNotifications'
import type { AppNotification } from '@/lib/types'

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
export function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read_at).length

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

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
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-11 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface shadow-2xl ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="text-sm font-bold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
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
                      n.read_at ? '' : 'bg-primary/5'
                    } hover:bg-white/[0.04]`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold">{n.title}</p>
                      {!n.read_at && <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="text-[10px] text-text-subtle">{relativeTime(n.created_at)}</p>
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
        </div>
      )}
    </div>
  )
}
