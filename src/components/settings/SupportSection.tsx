import { useSearch } from '@tanstack/react-router'
import { LifeBuoy } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel'
import { SettingsHeading } from '@/components/settings/SettingsHeading'
import { useFeature } from '@/hooks/useFeatures'

/** Settings → Support (Phase 6 B7, flag `feedback`). Opens from ?support=new|<thread id> (notifications, error page). */
export function SupportSection() {
  const on = useFeature('feedback')
  const search = useSearch({ from: '/_app/settings' })
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (on && search.support) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [on, search.support])
  if (!on) return null
  return (
    <section ref={ref} id="support" className="card scroll-mt-6 space-y-4" data-testid="support-section">
      <SettingsHeading icon={LifeBuoy} title="Support" color="var(--chart-2)" description="Tell us what’s broken, what you’d like, or ask a question. A real person replies." />
      <FeedbackPanel
        openThread={search.support && search.support !== 'new' ? search.support : null}
        prefill={search.support === 'new' ? { kind: 'problem', message: search.error ? `Something went wrong: ${search.error}` : '' } : undefined}
      />
    </section>
  )
}
