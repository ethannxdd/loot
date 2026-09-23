import { authLinkError } from '@/lib/auth-link-error'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { toast, Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/hooks/useAuth'
import { queryClient, router } from './router'
import './styles.css'

function InnerApp() {
  const auth = useAuth()
  const userId = auth.user?.id ?? null
  const lastUserId = useRef(userId)

  // TanStack Router only evaluates `beforeLoad` guards on navigation. When the signed-in user changes
  // (sign-in, sign-up, sign-out, session expiry) re-run them, so the app moves to the right screen
  // immediately instead of sitting on a stale one until a manual reload.
  useEffect(() => {
    if (lastUserId.current !== userId) {
      lastUserId.current = userId
      void router.invalidate()
    }
  }, [userId])

  // An expired or already-used email link: say so, and send signed-out visitors to the sign-in form to try again.
  const reportedLinkError = useRef(false)
  useEffect(() => {
    if (!authLinkError || reportedLinkError.current || auth.isLoading) return
    reportedLinkError.current = true
    toast.error(authLinkError.message, { duration: 8000 })
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    if (!auth.user) void router.navigate({ to: '/auth' })
  }, [auth.isLoading, auth.user])

  if (auth.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
      </div>
    )
  }

  return <RouterProvider router={router} context={{ auth, queryClient }} />
}

function ThemedToaster() {
  const { resolved } = useTheme()
  return <Toaster theme={resolved} position="top-center" richColors />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <InnerApp />
        </AuthProvider>
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
