import { createFileRoute } from '@tanstack/react-router'
import { AdminFeedbackThreadPage } from '@/pages/admin/AdminFeedbackThreadPage'

export const Route = createFileRoute('/admin/feedback/$feedbackId')({
  component: function FeedbackThreadRoute() {
    const { feedbackId } = Route.useParams()
    return <AdminFeedbackThreadPage feedbackId={feedbackId} />
  },
})
