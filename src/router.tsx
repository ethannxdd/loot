import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ErrorPage, NotFoundPage } from '@/components/ui/ErrorPages'
import { routeTree } from './routeTree.gen'

/** Turns whatever a failed Supabase/network call threw into a sentence a human can read. */
export function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return friendlyMessage(err.message)
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; details?: unknown }
    if (typeof e.message === 'string' && e.message) return friendlyMessage(e.message)
  }
  if (typeof err === 'string' && err) return friendlyMessage(err)
  return 'Something went wrong. Please try again.'
}

function friendlyMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return "Couldn't reach Loot. Check your connection and try again."
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return "You don't have permission to do that."
  }
  if (m.includes('jwt expired') || m.includes('invalid jwt')) {
    return 'Your session expired. Please sign in again.'
  }
  return message
}

/**
 * Every mutation in the app funnels through here, so a failed save is never silent.
 * A mutation can opt out with `meta: { silent: true }` or by supplying its own onError.
 */
const mutationCache = new MutationCache({
  onError: (error, _vars, _ctx, mutation) => {
    if (mutation.options.onError || mutation.meta?.silent) return
    toast.error(describeError(error))
  },
})

/** Failed reads: one toast per distinct failure (deduped by id) rather than one per component. */
const queryCache = new QueryCache({
  onError: (error, query) => {
    if (query.meta?.silent) return
    // Only announce the first failure for a query that has no data to show; background refetch failures are quiet.
    if (query.state.data !== undefined) return
    toast.error(describeError(error), { id: `query-error:${query.queryHash}` })
  },
})

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export const router = createRouter({
  routeTree,
  context: {
    // Populated for real by <RouterProvider context={{ auth, queryClient }} /> in main.tsx.
    auth: undefined!,
    queryClient,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultNotFoundComponent: NotFoundPage,
  defaultErrorComponent: ({ error, reset }) => <ErrorPage error={error} reset={reset} />,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
