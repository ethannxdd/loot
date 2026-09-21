import { Loader2, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/hooks/useAuth'
import { router } from '@/router'

type Mode = 'signin' | 'signup'
type Method = 'password' | 'magic'

export function AuthPage() {
  const { signInWithPassword, signUpWithPassword, signInWithMagicLink, signInWithGoogle } =
    useAuth()

  const [method, setMethod] = useState<Method>('password')
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const { error: authError } =
      mode === 'signin'
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password)
    setIsSubmitting(false)
    if (authError) {
      setError(authError)
      return
    }
    router.navigate({ to: '/' })
  }

  async function handleMagicLinkSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const { error: authError } = await signInWithMagicLink(email)
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
    if (authError) setError(authError)
  }

  return (
    <div className="loot-gradient flex min-h-dvh items-center justify-center p-5">
      <div className="animate-enter card-elevated w-full max-w-sm bg-background/95 backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={40} />
          <div>
            <h1 className="text-xl font-bold">
              Know your <span className="text-primary">loot</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Know your number before you spend it.
            </p>
          </div>
        </div>

        <div className="mb-5 flex rounded-[10px] border border-border bg-input p-1">
          <button
            type="button"
            onClick={() => {
              setMethod('password')
              setError(null)
              setMagicLinkSent(false)
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              method === 'password' ? 'bg-surface-3 text-foreground' : 'text-text-muted'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('magic')
              setError(null)
              setMagicLinkSent(false)
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              method === 'magic' ? 'bg-surface-3 text-foreground' : 'text-text-muted'
            }`}
          >
            Magic link
          </button>
        </div>

        {method === 'password' ? (
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
            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-xs text-alert">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="font-semibold text-primary"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        ) : magicLinkSent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Mail size={28} strokeWidth={1.75} className="text-primary" />
            <p className="text-sm">
              Check <span className="font-semibold">{email}</span> for a sign-in link.
            </p>
          </div>
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
            {error && <p className="text-xs text-alert">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              Send magic link
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-[11px] text-text-subtle">or</span>
          <div className="h-px flex-1 bg-hairline" />
        </div>

        <button type="button" onClick={handleGoogle} className="btn btn-ghost w-full">
          Continue with Google
        </button>
      </div>
    </div>
  )
}
