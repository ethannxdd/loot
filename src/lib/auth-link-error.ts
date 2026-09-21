/**
 * Supabase sends people back from an expired / already-used email link (magic link, password reset, confirmation)
 * with the failure in the URL hash: `#error=access_denied&error_code=otp_expired&error_description=…`.
 * Nothing else in the app reads it, so without this the visitor lands on the home page with no hint of what went
 * wrong. This module must be the FIRST import in main.tsx: it captures the hash synchronously, before the auth
 * client (which also inspects the hash) has a chance to tidy it away.
 */
export interface AuthLinkError {
  code: string
  message: string
}

function readAuthLinkError(): AuthLinkError | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const code = params.get('error_code') ?? params.get('error')
  if (!code) return null
  const expired = code === 'otp_expired' || /expired|invalid/i.test(params.get('error_description') ?? '')
  return {
    code,
    message: expired
      ? 'That email link has expired or was already used. Request a new one and try again.'
      : (params.get('error_description')?.replace(/\+/g, ' ') ?? 'That link did not work. Please try again.'),
  }
}

export const authLinkError: AuthLinkError | null = readAuthLinkError()
