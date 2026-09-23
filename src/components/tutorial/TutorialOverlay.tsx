import { useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { useTutorialContext } from '@/context/TutorialContext'
import { useUpdateProfile } from '@/hooks/useProfile'
import { TUTORIAL_STEPS } from '@/lib/tutorial-steps'

/** First element matching the selector that is actually on screen (the desktop sidebar is display:none on phones). */
function findVisible(selector: string): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return matches.find((el) => el.getClientRects().length > 0) ?? null
}

const SPOTLIGHT_PADDING = 10
const CARD_WIDTH = 320
const VIEWPORT_MARGIN = 16

/**
 * Full-screen spotlight tour. Measures the current step's target element (if any) and draws
 * a highlighted "hole" around it using the box-shadow trick — a single element whose shadow
 * covers the rest of the viewport, so no separate dimming layer is needed. Falls back to a
 * centred card (no hole) for intro/outro steps or when a step's selector isn't on screen.
 */
export function TutorialOverlay() {
  const { active, stepIndex, totalSteps, next, back, close } = useTutorialContext()
  const updateProfile = useUpdateProfile()
  const [rect, setRect] = useState<DOMRect | null>(null)
  // True while the step's page is loading / its target is being looked for — the card waits instead of flashing.
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (st) => st.location.pathname })

  const step = TUTORIAL_STEPS[stepIndex]
  const isLast = stepIndex === totalSteps - 1

  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close()
        updateProfile.mutate({ tutorial_completed: true })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    if (!active) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [active])

  // Open the step's page first.
  useEffect(() => {
    if (!active || !step) return
    if (pathname !== step.route) void navigate({ to: step.route })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex])

  useEffect(() => {
    if (!active || !step) return
    setRect(null)
    if (pathname !== step.route) {
      setSearching(true)
      return
    }
    if (step.selectors.length === 0) {
      window.scrollTo({ top: 0 })
      setSearching(false)
      return
    }
    setSearching(true)
    let raf = 0
    let attempts = 0
    let found: HTMLElement | null = null

    const locate = () => step.selectors.map(findVisible).find(Boolean) ?? null

    function tryMeasure() {
      // Give the page ~0.8s to load its data before settling for a fallback target (e.g. the page header).
      const primary = findVisible(step!.selectors[0])
      const el = primary ?? (attempts > 48 ? locate() : null)
      if (el) {
        found = el
        el.scrollIntoView?.({ block: 'center', behavior: 'instant' as ScrollBehavior })
        requestAnimationFrame(() => {
          setRect(el.getBoundingClientRect())
          setSearching(false)
        })
        return
      }
      attempts += 1
      if (attempts < 150) raf = requestAnimationFrame(tryMeasure)
      else setSearching(false) // nothing on screen — centred card
    }
    tryMeasure()

    function onViewportChange() {
      if (found?.isConnected) setRect(found.getBoundingClientRect())
    }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [active, step, stepIndex, pathname])

  if (!active || !step) return null

  function persistCompletion() {
    updateProfile.mutate({ tutorial_completed: true })
  }

  function handleNext() {
    if (isLast) {
      close()
      persistCompletion()
    } else {
      next()
    }
  }

  function handleSkip() {
    close()
    persistCompletion()
  }

  const hasSpotlight = Boolean(step.selectors.length > 0 && rect)

  // A target taller than the screen (or partly scrolled off it) is spotlighted only where it's actually visible,
  // so the hole and the tooltip always sit on screen.
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const visible = rect
    ? {
        top: Math.max(rect.top, 0),
        left: Math.max(rect.left, 0),
        bottom: Math.min(rect.bottom, viewportH),
        right: Math.min(rect.right, viewportW),
      }
    : null

  const spotlightStyle: CSSProperties = hasSpotlight && visible
    ? {
        position: 'fixed',
        top: visible.top - SPOTLIGHT_PADDING,
        left: visible.left - SPOTLIGHT_PADDING,
        width: visible.right - visible.left + SPOTLIGHT_PADDING * 2,
        height: visible.bottom - visible.top + SPOTLIGHT_PADDING * 2,
        borderRadius: 18,
        border: '2px solid var(--accent)',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
        transition: 'all 320ms cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: 'none',
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: 1,
        height: 1,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
        pointerEvents: 'none',
      }

  let tooltipStyle: CSSProperties
  if (hasSpotlight && visible) {
    const cardWidth = Math.min(CARD_WIDTH, viewportW - VIEWPORT_MARGIN * 2)
    const spaceBelow = viewportH - visible.bottom
    const spaceAbove = visible.top
    const CARD_MAX_HEIGHT = 260

    let left = visible.left
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportW - cardWidth - VIEWPORT_MARGIN))

    let vertical: CSSProperties
    if (spaceBelow >= CARD_MAX_HEIGHT || (spaceBelow >= spaceAbove && spaceAbove < CARD_MAX_HEIGHT)) {
      vertical = { top: Math.min(visible.bottom + SPOTLIGHT_PADDING + 14, viewportH - CARD_MAX_HEIGHT) }
    } else if (spaceAbove >= CARD_MAX_HEIGHT) {
      vertical = { bottom: viewportH - visible.top + SPOTLIGHT_PADDING + 14 }
    } else {
      // No room beside the target (it fills the screen): dock the card to the bottom edge.
      vertical = { bottom: VIEWPORT_MARGIN }
    }

    tooltipStyle = {
      position: 'fixed',
      left,
      width: cardWidth,
      transition: 'all 320ms cubic-bezier(0.16,1,0.3,1)',
      ...vertical,
    }
  } else {
    // Centred by the flex wrapper below — NOT by a transform: the card's entrance animation animates `transform`
    // and would override it, leaving the card hanging off the bottom-right of the centre point.
    tooltipStyle = { width: `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))` }
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <div style={spotlightStyle} />

      {!searching && (
      <div className={hasSpotlight ? undefined : 'pointer-events-none fixed inset-0 flex items-center justify-center'}>
      <div key={step.id} style={tooltipStyle} className="card-elevated animate-enter pointer-events-auto space-y-3 bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[17px] font-bold leading-snug tracking-[-0.01em]">{step.title}</p>
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Skip tour"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-fill hover:text-foreground"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        <p className="text-[14.5px] leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="tnum text-[12.5px] font-semibold text-text-subtle">
            {stepIndex + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={back}
                aria-label="Previous step"
                className="grid h-9 w-9 place-items-center rounded-full bg-fill text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={14} strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="btn btn-primary !min-h-9 !px-4 !text-[14px]"
            >
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ArrowRight size={14} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  )
}
