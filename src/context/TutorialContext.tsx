import { createContext, useContext, useState, type ReactNode } from 'react'
import { useFeatureFlags } from '@/hooks/useFeatures'
import { tutorialStepsFor, type TutorialStep } from '@/lib/tutorial-steps'

interface TutorialContextValue {
  active: boolean
  stepIndex: number
  totalSteps: number
  /** The tour for this person's feature flags. */
  steps: TutorialStep[]
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
  const { data: flags } = useFeatureFlags()
  const steps = tutorialStepsFor(flags)

  const value: TutorialContextValue = {
    active,
    stepIndex,
    totalSteps: steps.length,
    steps,
    start: () => {
      setStepIndex(0)
      setActive(true)
    },
    next: () => setStepIndex((i) => Math.min(i + 1, steps.length - 1)),
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
