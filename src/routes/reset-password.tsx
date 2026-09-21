import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'

// Public on purpose: the recovery link lands here with a short-lived session in the URL hash.
export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})
