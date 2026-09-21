import { createFileRoute, redirect } from '@tanstack/react-router'

// Parked (Ethan's call, Sept 2026) — AssistantPage, useAssistant.ts, assistant-context.ts, and
// the deployed supabase/functions/loot-assistant edge function are all untouched and ready to
// go. To re-enable: replace this beforeLoad redirect with `component: AssistantPage` again
// (see the previous version of this file, or LOOT-BUILD-LOG.md's Phase 4 section for the
// original), and re-link it in AppLayout.tsx / tutorial-steps.ts.
export const Route = createFileRoute('/_app/assistant')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})
