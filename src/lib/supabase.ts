import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  // Fails loudly in dev rather than silently producing a broken client.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill in your Supabase project values.',
  )
}

// ---------------------------------------------------------------------------------------------
// "Keep me signed in"
// ---------------------------------------------------------------------------------------------
// Supabase keeps the session in localStorage, so by default you stay signed in until you sign out.
// When someone unticks "Keep me signed in", we drop a *browser-session cookie* (no expiry date, so the
// browser deletes it when it's fully closed). On the next start, if they chose not to be remembered and
// that cookie is gone, the stored session is cleared before Supabase reads it — i.e. closing the browser
// signs them out, while every open tab keeps sharing the same session until then.

const REMEMBER_KEY = 'loot:remember-me'
const BROWSER_SESSION_COOKIE = 'loot_browser_session'

function hasBrowserSessionCookie(): boolean {
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${BROWSER_SESSION_COOKIE}=`))
}

function markBrowserSession() {
  document.cookie = `${BROWSER_SESSION_COOKIE}=1; path=/; SameSite=Lax`
}

/** Whether the person asked to stay signed in (default: yes). */
export function getRememberMe(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== '0'
  } catch {
    return true
  }
}

/** Call just before signing in (password, email link or Google). */
export function setRememberMe(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
  } catch {
    // storage unavailable — Supabase can't persist anything either
  }
  markBrowserSession()
}

function forgetSessionIfBrowserWasClosed() {
  if (typeof window === 'undefined') return
  try {
    if (!getRememberMe() && !hasBrowserSessionCookie()) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach((k) => localStorage.removeItem(k))
    }
  } catch {
    // ignore
  }
  markBrowserSession()
}

forgetSessionIfBrowserWasClosed()

export const supabase = createClient(supabaseUrl, supabaseKey)
