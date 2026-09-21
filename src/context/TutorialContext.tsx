import { createContext, useContext, useState, type ReactNode } from 'react'
import { TUTORIAL_STEPS } from '@/lib/tutorial-steps'

interface TutorialContextValue {
  active: boolean
  stepIndex: number
  totalSteps: number
  start: () => void
  next: () => void
  back: () => void
  /** Ends the tour without necessarily marking it complete — callers decide persistence. */
  close: () => void
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const value: TutorialContextValue = {
    active,
    stepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    start: () => {
      setStepIndex(0)
      setActive(true)
    },
    next: () => setStepIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1)),
    back: () => setStepIndex((i) => Math.max(i - 1, 0)),
    close: () => setActive(false),
  }

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>
}

export function useTutorialContext() {
  const ctx = useContext(TutorialContext)
  if (!ctx) throw new Error('useTutorialContext must be used within a TutorialProvider')
  return ctx
}
