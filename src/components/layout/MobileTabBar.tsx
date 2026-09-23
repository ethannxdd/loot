import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Glass } from '@/components/ui/Glass'
import { isActivePath, MOBILE_TABS } from '@/lib/nav'

const PAD = 5 // inner padding of the capsule
const SCRUB_THRESHOLD = 8 // px of movement before a press becomes a scrub
const COLLAPSED = 60

/**
 * iOS 26-style Liquid Glass tab bar.
 * - A glass "droplet" marks the current tab and slides between tabs on a spring.
 * - Press and drag along the bar to scrub: the droplet follows your finger, magnified like a lens, and lifting
 *   your finger opens the tab under it.
 * - Scrolling down shrinks the bar to just the current tab; scrolling up (or tapping it) brings it back.
 */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const navRef = useRef<HTMLElement>(null)
  const activeIndex = Math.max(0, MOBILE_TABS.findIndex((t) => isActivePath(pathname, t.to)))
  const hasActive = MOBILE_TABS.some((t) => isActivePath(pathname, t.to))

  const [scrubIndex, setScrubIndex] = useState<number | null>(null)
  const [pressed, setPressed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [fullWidth, setFullWidth] = useState(() => (typeof window === 'undefined' ? 360 : window.innerWidth - 24))
  const gesture = useRef<{ x: number; id: number; scrubbing: boolean } | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    const onResize = () => setFullWidth(window.innerWidth - 24)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Minimise on scroll down, restore on scroll up / near the top.
  useEffect(() => {
    let last = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const dy = y - last
      if (y < 60) setCollapsed(false)
      else if (dy > 8) setCollapsed(true)
      else if (dy < -8) setCollapsed(false)
      if (Math.abs(dy) > 8 || y < 60) last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A new page starts with the bar open.
  useEffect(() => setCollapsed(false), [pathname])

  function indexAt(clientX: number) {
    const rect = navRef.current!.getBoundingClientRect()
    const w = (rect.width - PAD * 2) / MOBILE_TABS.length
    return Math.max(0, Math.min(MOBILE_TABS.length - 1, Math.floor((clientX - rect.left - PAD) / w)))
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (collapsed) return
    gesture.current = { x: e.clientX, id: e.pointerId, scrubbing: false }
    setPressed(true)
    setScrubIndex(indexAt(e.clientX))
  }
  function onPointerMove(e: ReactPointerEvent) {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    if (!g.scrubbing && Math.abs(e.clientX - g.x) > SCRUB_THRESHOLD) {
      g.scrubbing = true
      navRef.current?.setPointerCapture(e.pointerId)
    }
    if (g.scrubbing) setScrubIndex(indexAt(e.clientX))
  }
  function endGesture(e: ReactPointerEvent, commit: boolean) {
    const g = gesture.current
    gesture.current = null
    setPressed(false)
    if (g?.scrubbing && commit) {
      const target = MOBILE_TABS[indexAt(e.clientX)]
      suppressClick.current = true
      if (!isActivePath(pathname, target.to)) void navigate({ to: target.to })
    }
    setScrubIndex(null)
  }

  const shownIndex = scrubIndex ?? activeIndex
  const showDroplet = hasActive || scrubIndex !== null
  const spring = reduceMotion ? { duration: 0 } : { type: 'spring' as const, bounce: 0.22, duration: 0.45 }
  const ActiveIcon = MOBILE_TABS[activeIndex].icon

  return (
    <>
      {/* Soft scroll-edge fade so content visibly passes under the glass instead of hitting a hard edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(72px+env(safe-area-inset-bottom))] bg-gradient-to-t from-background/80 to-transparent md:hidden"
      />
      <motion.div
        className="fixed left-3 z-40 md:hidden"
        style={{ bottom: 'calc(10px + env(safe-area-inset-bottom))' }}
        initial={false}
        animate={{ width: collapsed ? COLLAPSED : fullWidth }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.18, duration: 0.5 }}
      >
        <Glass
          as="nav"
          ref={navRef as never}
          aria-label="Tabs"
          className="flex h-[62px] touch-pan-y items-center overflow-hidden rounded-full select-none"
          style={{ padding: PAD }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endGesture(e, true)}
          onPointerCancel={(e) => endGesture(e, false)}
          onClickCapture={(e) => {
            if (suppressClick.current) {
              e.preventDefault()
              e.stopPropagation()
              suppressClick.current = false
            }
          }}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label={`${MOBILE_TABS[activeIndex].label} — show all tabs`}
              className="glass-droplet grid h-[52px] w-[52px] place-items-center rounded-full text-primary"
            >
              <ActiveIcon size={22} strokeWidth={2.1} />
            </button>
          ) : (
            <div className="relative flex h-full w-full">
              {showDroplet && (
                <motion.span
                  aria-hidden
                  className="glass-droplet absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${100 / MOBILE_TABS.length}%` }}
                  initial={false}
                  animate={{
                    x: `${shownIndex * 100}%`,
                    scale: pressed ? 1.14 : 1,
                    scaleY: pressed ? 1.22 : 1,
                  }}
                  transition={spring}
                />
              )}
              {MOBILE_TABS.map((item, i) => {
                const isActive = isActivePath(pathname, item.to)
                const lit = scrubIndex !== null ? i === scrubIndex : isActive
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={isActive ? 'page' : undefined}
                    draggable={false}
                    className={`relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors duration-150 ${
                      lit ? 'text-primary' : 'text-foreground/75'
                    }`}
                  >
                    <motion.span
                      className="grid place-items-center"
                      animate={{ scale: pressed && scrubIndex === i ? 1.18 : 1 }}
                      transition={spring}
                    >
                      <Icon size={22} strokeWidth={lit ? 2.1 : 1.8} />
                    </motion.span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )}
        </Glass>
      </motion.div>
    </>
  )
}
