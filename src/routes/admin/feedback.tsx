import { createFileRoute, Outlet } from '@tanstack/react-router'

// Pass-through layout so /admin/feedback and /admin/feedback/$feedbackId share the "Feedback" nav item.
export const Route = createFileRoute('/admin/feedback')({
  component: Outlet,
})
