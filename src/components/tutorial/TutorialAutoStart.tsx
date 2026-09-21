import { useEffect, useRef } from 'react'
import { useTutorialContext } from '@/context/TutorialContext'
import { useProfile } from '@/hooks/useProfile'

/**
 * Headless. Auto-launches the guided tour the first time a user's profile loads with
 * `tutorial_completed: false` — in practice, right after onboarding redirects them to the
 * Dashboard. Fires once per session (guarded by a ref) so a later background refetch of the
 * profile — before the completion mutation has round-tripped — can't retrigger it.
 */
export function TutorialAutoStart() {
  const { data: profile } = useProfile()
  const { start, active } = useTutorialContext()
  const hasTriggered = useRef(false)

  useEffect(() => {
    if (hasTriggered.current || active || !profile) return
    if (profile.tutorial_completed) return

    // Flag inside the timeout (not before it): React StrictMode runs effects twice in development, and
    // flagging first would let the first run's cleared timer "use up" the only launch.
    const timer = setTimeout(() => {
      hasTriggered.current = true
      start()
    }, 700)
    return () => clearTimeout(timer)
  }, [profile, active, start])

  return null
}
