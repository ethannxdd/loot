import { createFileRoute, Outlet } from '@tanstack/react-router'

// Thin pass-through layout — keeps /goals and /goals/$goalId as independent
// pages (both rendered by AppLayout already) while satisfying the flat-route
// convention, which otherwise treats a bare `goals.tsx` next to
// `goals.$goalId.tsx` as sole owner of `/goals`.
export const Route = createFileRoute('/_app/goals')({
  component: () => <Outlet />,
})
