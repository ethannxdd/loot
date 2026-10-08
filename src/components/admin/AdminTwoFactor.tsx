import { Link } from '@tanstack/react-router'
import { Copy, Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AuthShell } from '@/components/auth/AuthShell'
import { supabase } from '@/lib/supabase'

/** Supabase returns the QR as `data:image/svg+xml;utf-8,<svg…>`; re-encode it so every browser renders it. */
function qrSrc(raw: string): string {
  const m = raw.match(/^data:image\/svg\+xml;(?:charset=)?utf-8,(.*)$/s)
  if (!m || !m[1].trimStart().startsWith("<")) return raw // already encoded (or another format)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(m[1])}`
}

type Step =
  | { kind: 'loading' }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string }
  | { kind: 'verify'; factorId: string }
  | { kind: 'error'; message: string }

/**
 * Two-factor gate for the admin portal (Supabase MFA, TOTP — free on every plan).
 * First visit: scan a QR code with an authenticator app (Google Authenticator, 1Password, Authy…) and enter
 * the 6-digit code. After that: just the code, once per sign-in. A verified code upgrades the session to
 * `aal2`, which every admin database function and the admin-actions function require.
 */
export function AdminTwoFactor() {
  const [step, setStep] = useState<Step>({ kind: 'loading' })
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) {
        if (!cancelled) setStep({ kind: 'error', message: listError.message })
        return
      }
      const verified = data.totp[0]
      if (verified) {
        if (!cancelled) setStep({ kind: 'verify', factorId: verified.id })
        return
      }
      // Clear any half-finished enrolment so a fresh QR code can be issued.
      for (const f of data.all.filter((x) => x.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Loot admin ${new Date().toISOString().slice(0, 10)}`,
      })
      if (cancelled) return
      if (enrollError || !enrolled) {
        setStep({
          kind: 'error',
          message: /disabled|not enabled/i.test(enrollError?.message ?? '')
            ? 'Two-factor (TOTP) is switched off for this Supabase project. Turn it on under Authentication → Multi-Factor.'
            : (enrollError?.message ?? 'Couldn’t start two-factor setup.'),
        })
        return
      }
      setStep({ kind: 'enroll', factorId: enrolled.id, qr: qrSrc(enrolled.totp.qr_code), secret: enrolled.totp.secret })
    }
    void start()
    return () => {
      cancelled = true
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (step.kind !== 'enroll' && step.kind !== 'verify') return
    setPending(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: step.factorId, code })
    setPending(false)
    if (verifyError) {
      setError(/invalid|expired/i.test(verifyError.message) ? 'That code didn’t work. Codes change every 30 seconds — try the current one.' : verifyError.message)
      setCode('')
      return
    }
    if (step.kind === 'enroll') toast.success('Two-factor is on for your account')
    // The session is now aal2; AuthContext picks up the new token and the portal opens.
  }

  const enrolling = step.kind === 'enroll'

  return (
    <AuthShell
      back={false}
      title={enrolling ? 'Set up two-factor' : 'Two-factor sign-in'}
      subtitle={
        enrolling
          ? 'The admin portal can change people’s accounts, so it needs a second step. You only set this up once.'
          : 'Enter the 6-digit code from your authenticator app to open the admin portal.'
      }
    >
      <div className="space-y-5" data-testid="admin-2fa">
        {step.kind === 'loading' && (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {step.kind === 'error' && (
          <div className="card space-y-3">
            <p role="alert" className="text-[15px] font-medium text-alert">
              {step.message}
            </p>
            <Link to="/dashboard" className="btn btn-secondary w-full">
              Back to my Loot
            </Link>
          </div>
        )}

        {step.kind === 'enroll' && (
          <div className="card space-y-4">
            <ol className="space-y-1.5 text-[14px] leading-relaxed text-muted-foreground">
              <li>1. Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
              <li>2. Add an account and scan this code.</li>
              <li>3. Enter the 6-digit code it shows.</li>
            </ol>
            <div className="flex justify-center">
              <img src={step.qr} alt="QR code for your authenticator app" className="h-44 w-44 rounded-xl bg-white p-2" />
            </div>
            <div>
              <p className="field-label">Can’t scan? Enter this key instead</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(step.secret).then(() => toast.success('Key copied'))
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl bg-fill px-3 py-2.5 text-left font-mono text-[13px] break-all"
              >
                {step.secret}
                <Copy size={15} className="shrink-0 text-text-subtle" />
              </button>
            </div>
          </div>
        )}

        {(step.kind === 'enroll' || step.kind === 'verify') && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="totp-code">
                6-digit code
              </label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="text-center !text-[22px] font-semibold tracking-[0.3em] tabular-nums"
              />
            </div>
            {error && (
              <p role="alert" className="text-[13px] font-medium text-alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={pending || code.length !== 6} className="btn btn-primary w-full !min-h-12 !text-[16px]">
              {pending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {enrolling ? 'Turn on two-factor' : 'Open admin portal'}
            </button>
            <Link to="/dashboard" className="block text-center text-[14px] font-semibold text-primary">
              Back to my Loot
            </Link>
          </form>
        )}
      </div>
    </AuthShell>
  )
}
