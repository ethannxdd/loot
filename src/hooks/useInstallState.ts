import { useSyncExternalStore } from 'react'
import { getInstallState, subscribeInstall } from '@/lib/pwa'

let cached = getInstallState()
function snapshot() {
  const next = getInstallState()
  if (next.canPrompt !== cached.canPrompt || next.installed !== cached.installed) cached = next
  return cached
}

/** Whether the browser can show its install dialog, and whether Loot is already installed. */
export function useInstallState() {
  return useSyncExternalStore(subscribeInstall, snapshot, snapshot)
}
