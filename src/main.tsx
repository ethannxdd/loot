import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { useAuth } from '@/hooks/useAuth'
import { queryClient, router } from './router'
import './styles.css'

function InnerApp() {
  const auth = useAuth()

  if (auth.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
      </div>
    )
  }

  return <RouterProvider router={router} context={{ auth, queryClient }} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  </StrictMode>,
)
