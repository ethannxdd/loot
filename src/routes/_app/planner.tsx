import { createFileRoute } from '@tanstack/react-router'
import { PlannerPage } from '@/pages/PlannerPage'

export const Route = createFileRoute('/_app/planner')({
  // `/planner?plan=<id>` opens a saved plan in the workspace, `?plan=new` starts a new one.
  validateSearch: (search: Record<string, unknown>): { plan?: string } => ({
    plan: typeof search.plan === 'string' && search.plan ? search.plan : undefined,
  }),
  component: PlannerPage,
})
