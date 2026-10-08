import { createFileRoute, redirect } from '@tanstack/react-router'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'

// The admin portal (see claude/LOOT-ADMIN-PORTAL.md). This guard only decides whether to show the portal;
// every admin read and action is checked again by the database / edge function.
export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context }) => {
    if (!context.auth.user) throw redirect({ to: '/auth' })
    const { data, error } = await supabase.rpc('admin_me')
    if (error || !(data as { role: string | null } | null)?.role) throw redirect({ to: '/dashboard' })
  },
  component: AdminLayout,
})
