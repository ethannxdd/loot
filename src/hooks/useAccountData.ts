import { useMutation, useQueryClient } from '@tanstack/react-query'
import { describeFunctionError, isFunctionMissing } from '@/lib/function-error'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/** Every table that holds this user's own rows, keyed by the column that identifies the owner. */
const USER_TABLES: { table: string; ownerColumn: string }[] = [
  { table: 'profiles', ownerColumn: 'id' },
  { table: 'expenses', ownerColumn: 'user_id' },
  { table: 'income_streams', ownerColumn: 'user_id' },
  { table: 'savings_goals', ownerColumn: 'user_id' },
  { table: 'goal_contributions', ownerColumn: 'user_id' },
  { table: 'monthly_snapshots', ownerColumn: 'user_id' },
  { table: 'monthly_briefings', ownerColumn: 'user_id' },
  { table: 'affordability_checks', ownerColumn: 'user_id' },
  { table: 'planner_plans', ownerColumn: 'user_id' },
  { table: 'debts', ownerColumn: 'user_id' },
  { table: 'net_worth_items', ownerColumn: 'user_id' },
  { table: 'notifications', ownerColumn: 'user_id' },
  { table: 'spending_alerts', ownerColumn: 'user_id' },
  { table: 'statement_analyses', ownerColumn: 'user_id' },
  { table: 'subscription_reviews', ownerColumn: 'user_id' },
  { table: 'tax_profile', ownerColumn: 'user_id' },
  { table: 'tax_year_data', ownerColumn: 'user_id' },
  { table: 'budge_scores', ownerColumn: 'user_id' },
  { table: 'bureau_scores', ownerColumn: 'user_id' },
  { table: 'score_calibration', ownerColumn: 'user_id' },
  { table: 'assistant_conversations', ownerColumn: 'user_id' },
  { table: 'assistant_messages', ownerColumn: 'user_id' },
]

/** Tables wiped by "Reset all data" — everything except the profile row itself, which is reset separately. */
const RESET_TABLES = USER_TABLES.filter((t) => t.table !== 'profiles')

/** Downloads everything Loot stores about the signed-in user as a single JSON file. */
export function useExportData() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in')
      const result: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email },
      }
      for (const { table, ownerColumn } of USER_TABLES) {
        // Filtering on the owner matters: household RLS also lets you READ a partner's profile,
        // expenses and snapshots, and those must never end up in your export.
        const { data, error } = await supabase.from(table).select('*').eq(ownerColumn, user.id)
        if (error) throw new Error(`Couldn't export ${table}: ${error.message}`)
        result[table] = data
      }
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const now = new Date()
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      a.download = `loot-export-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  })
}

/**
 * Deletes everything the user has entered (expenses, goals, snapshots, plans, tax data, …) and zeroes their
 * income, but keeps the account, name, currency and household membership so they can start fresh.
 */
export function useResetAllData() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in')
      for (const { table, ownerColumn } of RESET_TABLES) {
        const { error } = await supabase.from(table).delete().eq(ownerColumn, user.id)
        if (error) throw new Error(`Couldn't clear ${table}: ${error.message}`)
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          gross_income: 0,
          net_income: 0,
          safety_buffer_pct: 12.5,
          debt_strategy: null,
          debt_extra_payment: 0,
          household_view: false,
          multi_currency_enabled: false,
        })
        .eq('id', user.id)
      if (error) throw error
      try {
        // Manual statement merchant → category corrections are stored in the browser.
        Object.keys(localStorage)
          .filter((k) => k.toLowerCase().includes('loot'))
          .forEach((k) => localStorage.removeItem(k))
      } catch {
        // storage unavailable — nothing to clear
      }
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * Permanently deletes the account. The actual deletion happens in the `delete-account` edge function (it needs
 * the service-role key, which can't live in the browser); every table cascades from the auth user, so all of
 * the person's data goes with it. On success this signs the browser out and clears anything stored locally.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } })
      if (error) {
        if (isFunctionMissing(error)) {
          throw new Error("Account deletion isn't switched on for this Loot server yet. Nothing was deleted.")
        }
        throw new Error(await describeFunctionError(error))
      }
      try {
        Object.keys(localStorage)
          .filter((k) => k.toLowerCase().includes('loot'))
          .forEach((k) => localStorage.removeItem(k))
      } catch {
        // storage unavailable — nothing to clear
      }
      // The account is gone server-side; drop the now-dead session from this browser.
      // Signing out also empties the query cache (AuthProvider clears it whenever the user changes), so there is
      // deliberately no cache clear here: doing it while this screen is still mounted made the profile query
      // refetch for the deleted user and flash an error toast.
      await supabase.auth.signOut({ scope: 'local' })
    },
  })
}
