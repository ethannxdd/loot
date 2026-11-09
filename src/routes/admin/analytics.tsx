import { createFileRoute } from '@tanstack/react-router'
import { AdminAnalyticsPage } from '@/pages/admin/AdminAnalyticsPage'

export const Route = createFileRoute('/admin/analytics')({
  component: AdminAnalyticsPage,
})
