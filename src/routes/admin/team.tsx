import { createFileRoute } from '@tanstack/react-router'
import { AdminTeamPage } from '@/pages/admin/AdminTeamPage'

export const Route = createFileRoute('/admin/team')({
  component: AdminTeamPage,
})
