import { Link, useNavigate } from '@tanstack/react-router'
import { KeyRound, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AuthShell } from '@/components/auth/AuthShell'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useAuth } from '@/hooks/useAuth'

/** Landing page for the link in a password-reset email. */
export function ResetPasswordPage() {
  const { user, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('Use at least 6 characters.')
    if (password !== confirm) return setError("Those passwords don't match.")
    setIsSubmitting(true)
    const { error: updateError } = await updatePassword(password)
    setIsSubmitting(false)
    if (updateError) return setError(updateError)
    toast.success('Password updated')
    void navigate({ to: '/' })
  }

  return (
    <AuthShell
      title={user ? 'Choose a new password' : 'This link has expired'}
      subtitle={user ? 'At least 6 characters. You’ll stay signed in afterwards.' : undefined}
    >

        {user ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="new-password">
                New password
              </label>
              <PasswordInput
                id="new-password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="confirm-password">
                Confirm password
              </label>
              <PasswordInput
                id="confirm-password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-[13px] font-medium text-alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full !min-h-12 !text-[16px]">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Update password
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <p className="text-[16px] leading-relaxed text-muted-foreground">
              Reset links work once and expire after a while. Request a new one from the sign-in page.
            </p>
            <Link to="/auth" className="btn btn-primary w-full !min-h-12 !text-[16px]">
              Back to sign in
            </Link>
          </div>
        )}
    </AuthShell>
  )
}
