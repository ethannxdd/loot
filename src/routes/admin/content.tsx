import { createFileRoute } from '@tanstack/react-router'
import { AdminContentPage } from '@/pages/admin/AdminContentPage'

export const Route = createFileRoute('/admin/content')({
  component: AdminContentPage,
})
