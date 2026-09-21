import { createFileRoute } from '@tanstack/react-router'
import { GoalDetailPage } from '@/pages/GoalDetailPage'

export const Route = createFileRoute('/_app/goals/$goalId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { goalId } = Route.useParams()
  return <GoalDetailPage goalId={goalId} />
}
