import { useSearch } from '@tanstack/react-router'
import { Loader2, Mail } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { AuthShell } from '@/components/auth/AuthShell'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Segmented } from '@/components/ui/Segmented'
import { useAuth } from '@/hooks/useAuth'

type Mode = 'signin' | 'signup' | 'forgot'
type Method = 'password' | 'magic'

export function AuthPage() {
  const {
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
    signInWithGoogle,
    resetPassword,
  } = useAuth()

  const [method, setMethod] = useState<Method>('password')
  const search = useSearch({ from: '/auth' })
  const [mode, setMode] = useState<Mode>(search.mode === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    if (mode === 'forgot') {
      const { error: resetError } = await resetPassword(email.trim())
      setIsSubmitting(false)
      if (resetError) setError(resetError)
      else setResetSent(true)
      return
    }

    if (mode === 'signin') {
      const { error: authError } = await signInWithPassword(email.trim(), password)
      setIsSubmitting(false)
      if (authError) setError(authError)
      // On success the auth state change re-runs the route guards and moves us on.
      return
    }

    const { error: authError, needsConfirmation } = await signUpWithPassword(email.trim(), password)
    setIsSubmitting(false)
    if (authError) {
      setError(authError)
      return
    }
    // Projects that require email confirmation issue no session — say so instead of doing nothing.
    if (needsConfirmation) setConfirmationSent(true)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setResetSent(false)
    setConfirmationSent(false)
  }

  async function handleMagicLinkSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const { error: authError } = await signInWithMagicLink(email.trim())
    setIsSubmitting(false)
    if (authError) {
      setError(authError)
      return
    }
    setMagicLinkSent(true)
  }

  async function handleGoogle() {
    setError(null)
    const { error: authError } = await signInWithGoogle()
    if (authError) {
      setError(
        /provider is not enabled|unsupported provider/i.test(authError)
          ? 'Google sign-in is not available right now. Use your email instead.'
          : authError,
      )
    }
  }

  const title =
    method === 'magic'
      ? 'Sign in with a link'
      : mode === 'signup'
        ? 'Create your account'
        : mode === 'forgot'
          ? 'Reset your password'
          : 'Welcome back'
  const subtitle =
    method === 'magic'
      ? 'We’ll email you a link. No password needed.'
      : mode === 'signup'
        ? 'Free, and about five minutes to set up.'
        : mode === 'forgot'
          ? 'Enter your email and we’ll send you a reset link.'
          : 'Sign in to see your numbers.'

  return (
    <AuthShell title={title} subtitle={subtitle}>
      <div className="mb-6">
        <Segmented
          full
          label="Sign-in method"
          value={method}
          onChange={(next) => {
            setMethod(next)
            setError(null)
            setMagicLinkSent(false)
          }}
          options={[
            { value: 'password', label: 'Password' },
            { value: 'magic', label: 'Email link' },
          ]}
        />
      </div>

      {method === 'password' && (confirmationSent || resetSent) ? (
        <SentNotice onBack={() => switchMode('signin')}>
          {confirmationSent ? (
            <>
              We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>. Open it to activate
              your account, then sign in.
            </>
          ) : (
            <>
              If <span className="font-semibold text-foreground">{email}</span> has a Loot account, a reset link is on its way.
            </>
          )}
        </SentNotice>
      ) : method === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-baseline justify-between">
                <label className="field-label" htmlFor="password">
                  Password
                </label>
                {mode === 'signin' && (
                  <button type="button" onClick={() => switchMode('forgot')} className="text-[13px] font-semibold text-primary">
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordInput
                id="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              {mode === 'signup' && <p className="mt-1.5 text-[13px] text-muted-foreground">At least 6 characters.</p>}
            </div>
          )}
          {error && (
            <p role="alert" className="text-[13px] font-medium text-alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full !min-h-12 !text-[16px]">
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
          <p className="text-center text-[14px] text-muted-foreground">
            {mode === 'signin' ? 'New to Loot? ' : mode === 'signup' ? 'Already have an account? ' : 'Remembered it? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'signup' || mode === 'forgot' ? 'signin' : 'signup')}
              className="font-semibold text-primary"
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </form>
      ) : magicLinkSent ? (
        <SentNotice onBack={() => setMagicLinkSent(false)} backLabel="Use a different email">
          Check <span className="font-semibold text-foreground">{email}</span> for your sign-in link.
        </SentNotice>
      ) : (
        <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="magic-email">
              Email
            </label>
            <input
              id="magic-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full !min-h-12 !text-[16px]">
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Email me a link
          </button>
        </form>
      )}

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline" />
        <span className="text-[13px] text-text-subtle">or</span>
        <div className="h-px flex-1 bg-hairline" />
      </div>

      <button type="button" onClick={handleGoogle} className="btn btn-secondary w-full !min-h-12 !text-[16px]">
        <GoogleMark />
        Continue with Google
      </button>
      {error && (magicLinkSent || confirmationSent || resetSent) && (
        <p role="alert" className="mt-3 text-center text-[13px] font-medium text-alert">
          {error}
        </p>
      )}
      <p className="mt-8 text-center text-[12.5px] leading-relaxed text-text-subtle">
        Loot gives estimates and guidance, not financial advice.
      </p>
    </AuthShell>
  )
}

function SentNotice({ children, onBack, backLabel = 'Back to sign in' }: { children: ReactNode; onBack: () => void; backLabel?: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/12 text-primary">
        <Mail size={26} strokeWidth={2} />
      </span>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{children}</p>
      <button type="button" onClick={onBack} className="mt-1 text-[14px] font-semibold text-primary">
        {backLabel}
      </button>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
