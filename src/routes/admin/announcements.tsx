import { createFileRoute } from '@tanstack/react-router'
import { AdminAnnouncementsPage } from '@/pages/admin/AdminAnnouncementsPage'

export const Route = createFileRoute('/admin/announcements')({
  component: AdminAnnouncementsPage,
})
