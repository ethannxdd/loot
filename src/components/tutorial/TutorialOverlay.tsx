import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { useTutorialContext } from '@/context/TutorialContext'
import { useUpdateProfile } from '@/hooks/useProfile'
import { TUTORIAL_STEPS } from '@/lib/tutorial-steps'

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
      const el = document.querySelector(step!.selector!) as HTMLElement | null
      if (el) {
        setRect(el.getBoundingClientRect())
        return
      }
      attempts += 1
      if (attempts < 40) raf = requestAnimationFrame(tryMeasure)
    }
    tryMeasure()

    function onViewportChange() {
      const el = document.querySelector(step!.selector!) as HTMLElement | null
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

  const spotlightStyle: CSSProperties = hasSpotlight
    ? {
        position: 'fixed',
        top: rect!.top - SPOTLIGHT_PADDING,
        left: rect!.left - SPOTLIGHT_PADDING,
        width: rect!.width + SPOTLIGHT_PADDING * 2,
        height: rect!.height + SPOTLIGHT_PADDING * 2,
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
  if (hasSpotlight) {
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const spaceBelow = viewportH - rect!.bottom
    const placeBelow = spaceBelow > 220 || rect!.top < 220

    let left = rect!.left
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportW - CARD_WIDTH - VIEWPORT_MARGIN))

    tooltipStyle = {
      position: 'fixed',
      left,
      width: CARD_WIDTH,
      transition: 'all 320ms cubic-bezier(0.16,1,0.3,1)',
      ...(placeBelow
        ? { top: rect!.bottom + SPOTLIGHT_PADDING + 14 }
        : { bottom: viewportH - rect!.top + SPOTLIGHT_PADDING + 14 }),
    }
  } else {
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      width: CARD_WIDTH,
      transform: 'translate(-50%, -50%)',
    }
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <div style={spotlightStyle} />

      <div style={tooltipStyle} className="card-elevated animate-enter space-y-3 bg-surface p-5">
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
  )
}
