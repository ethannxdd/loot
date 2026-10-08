import { createFileRoute } from '@tanstack/react-router'
import { AdminFlagsPage } from '@/pages/admin/AdminFlagsPage'

export const Route = createFileRoute('/admin/flags')({
  component: AdminFlagsPage,
})
