import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/pages/SettingsPage'

export interface SettingsSearch {
  /** Phase 6 B7: open Support — 'new' for the form, or a feedback thread id (from a support-reply notification). */
  support?: string
  /** "Report this" from the error page: what went wrong. */
  error?: string
}

export const Route = createFileRoute('/_app/settings')({
  validateSearch: (s: Record<string, unknown>): SettingsSearch => ({
    support: typeof s.support === 'string' && /^(new|[0-9a-f-]{36})$/.test(s.support) ? s.support : undefined,
    error: typeof s.error === 'string' ? s.error.slice(0, 300) : undefined,
  }),
  component: SettingsPage,
})
