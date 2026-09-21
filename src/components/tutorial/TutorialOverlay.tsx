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

  useEffect(() => {
    if (!active || !step?.selector) {
      setRect(null)
      return
    }
    setRect(null)
    let raf = 0
    let attempts = 0

    function tryMeasure() {
      const el = findVisible(step!.selector!)
      if (el) {
        // Bring the target into view first (on phones it can be well below the fold).
        el.scrollIntoView?.({ block: 'center', behavior: 'instant' as ScrollBehavior })
        setRect(el.getBoundingClientRect())
        return
      }
      attempts += 1
      if (attempts < 40) raf = requestAnimationFrame(tryMeasure)
    }
    tryMeasure()

    function onViewportChange() {
      const el = findVisible(step!.selector!)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [active, step, stepIndex])

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

  const hasSpotlight = Boolean(step.selector && rect)

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
        borderRadius: 14,
        border: '2px solid #C1FE72',
        boxShadow: '0 0 0 9999px rgba(15,10,10,0.86)',
        transition: 'all 320ms cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: 'none',
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: 1,
        height: 1,
        boxShadow: '0 0 0 9999px rgba(15,10,10,0.86)',
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

      <div className={hasSpotlight ? undefined : 'pointer-events-none fixed inset-0 flex items-center justify-center'}>
      <div style={tooltipStyle} className="card-elevated animate-enter pointer-events-auto space-y-3 bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-bold leading-snug">{step.title}</p>
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Skip tour"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-white/[0.08] hover:text-foreground"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-semibold text-text-subtle">
            {stepIndex + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={back}
                aria-label="Previous step"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                <ArrowLeft size={14} strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="btn btn-primary !min-h-0 !py-2 !px-4 text-xs"
            >
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ArrowRight size={14} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
