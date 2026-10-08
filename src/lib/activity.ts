import { isNativeShell, isStandalone } from '@/lib/pwa'
import { supabase } from '@/lib/supabase'

/**
 * Records that the signed-in person opened Loot today — at most one call per user per day, and the server
 * keeps one row per user per day (no pages, clicks or amounts). Powers active users and platform stats in
 * the admin portal. Never throws.
 */
export function currentPlatform(): 'browser' | 'pwa' | 'ios' | 'android' {
  if (isNativeShell()) {
    const p = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.()
    return p === 'android' ? 'android' : 'ios'
  }
  return isStandalone() ? 'pwa' : 'browser'
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function trackActivity(userId: string): Promise<void> {
  const key = `loot:activity:${userId}`
  const stamp = `${today()}:${currentPlatform()}`
  try {
    if (localStorage.getItem(key) === stamp) return
  } catch {
    // storage unavailable — just send it
  }
  const { error } = await supabase.rpc('track_activity', { p_platform: currentPlatform() })
  if (error) return
  try {
    localStorage.setItem(key, stamp)
  } catch {
    // ignore
  }
}
