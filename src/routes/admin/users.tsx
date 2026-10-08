import { createFileRoute, Outlet } from '@tanstack/react-router'

// Pass-through layout so /admin/users and /admin/users/$userId share the "Users" nav item.
export const Route = createFileRoute('/admin/users')({
  component: Outlet,
})
