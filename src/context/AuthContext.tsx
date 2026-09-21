import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  /** True while the initial session is being resolved on first load. */
  isLoading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  /** `needsConfirmation` is true when the project requires email confirmation and no session was issued. */
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  /** Sends a password-reset email. */
  resetPassword: (email: string) => Promise<{ error: string | null }>
  /** Sets a new password for the current (recovery) session. */
  updatePassword: (password: string) => Promise<{ error: string | null }>
  /** True right after following a password-recovery link. */
  isRecovery: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)
  const queryClient = useQueryClient()
  const lastUserId = useRef<string | null | undefined>(undefined)

  // Wipe every cached query whenever the signed-in user changes (sign-out, or switching accounts)
  // so one person's data can never flash up for the next person on a shared device.
  // This runs as an effect *after* the new session has rendered, not inside the auth callback: clearing the cache
  // while screens still think the old user is signed in makes their queries refetch for that user straight away
  // (after an account deletion that surfaced as a spurious "no rows returned" error toast).
  const currentUserId = session?.user.id ?? null
  useEffect(() => {
    if (isLoading) return
    if (lastUserId.current !== undefined && lastUserId.current !== currentUserId) {
      queryClient.clear()
    }
    lastUserId.current = currentUserId
  }, [currentUserId, isLoading, queryClient])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      if (event === 'SIGNED_OUT') setIsRecovery(false)
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const redirectTo = `${window.location.origin}/dashboard`

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    isLoading,
    async signInWithPassword(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
    },
    async signUpWithPassword(email, password) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) return { error: error.message, needsConfirmation: false }
      // Supabase deliberately returns a user with no identities for an already-registered email
      // (to avoid leaking which emails exist) — treat it as the "already registered" case.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return {
          error: 'An account with this email already exists. Try signing in instead.',
          needsConfirmation: false,
        }
      }
      return { error: null, needsConfirmation: !data.session }
    },
    async resetPassword(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      return { error: error?.message ?? null }
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (!error) setIsRecovery(false)
      return { error: error?.message ?? null }
    },
    isRecovery,
    async signInWithMagicLink(email) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })
      return { error: error?.message ?? null }
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      return { error: error?.message ?? null }
    },
    async signOut() {
      await supabase.auth.signOut()
      queryClient.clear()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
