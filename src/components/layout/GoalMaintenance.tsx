import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useAutoAllocation } from '@/hooks/useAutoAllocation'
import { goalsQueryKey, useGoals } from '@/hooks/useGoals'
import { completionPatch, shouldAutoResume } from '@/lib/goal-math'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

/**
 * Headless housekeeping for goals, once per session and per month:
 *  1. Paused goals whose "resume on" date has arrived are switched back on.
 *  2. With auto-progress timing set to "1st of the month", each auto goal is paid its share the first time
 *     Loot is opened in a new month. (Each payment claims the month on the goal row, so this can never
 *     double-pay, even with two tabs open.)
 */
export function GoalMaintenance() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: goals } = useGoals()
  const auto = useAutoAllocation()
  const resumed = useRef<string | null>(null)
  const paid = useRef<string | null>(null)

  // 1. Auto-resume
  useEffect(() => {
    if (!user || !goals || resumed.current === user.id) return
    resumed.current = user.id
    const due = goals.filter((g) => shouldAutoResume(g))
    if (due.length === 0) return
    void (async () => {
      const results = await Promise.all(
        due.map((g) => supabase.from('savings_goals').update({ is_paused: false, resume_date: null }).eq('id', g.id)),
      )
      if (results.some((r) => r.error)) return
      await queryClient.invalidateQueries({ queryKey: goalsQueryKey(user.id) })
      toast(`${due.map((g) => g.name).join(', ')} ${due.length === 1 ? 'is' : 'are'} back on track`, {
        description: 'Your pause ended, so the goal counts towards your monthly commitment again.',
      })
    })()
  }, [user, goals, queryClient])

  // 2. Monthly auto-apply
  useEffect(() => {
    if (!user || !goals || !auto.ready || auto.timing !== 'monthly_1st') return
    const key = `${user.id}:${auto.period}`
    if (paid.current === key) return
    paid.current = key

    const todo = goals.filter(
      (g) => g.progress_mode === 'auto' && !g.is_paused && !g.is_completed && g.last_auto_period !== auto.period && (auto.shares[g.id] ?? 0) > 0,
    )
    if (todo.length === 0) return

    void (async () => {
      let total = 0
      let count = 0
      for (const goal of todo) {
        const share = Math.round((auto.shares[goal.id] ?? 0) * 100) / 100
        try {
          const { data: fresh } = await supabase.from('savings_goals').select('*').eq('id', goal.id).maybeSingle()
          if (!fresh || fresh.last_auto_period === auto.period || fresh.is_completed) continue
          const amount = Math.min(share, Math.max(0, fresh.target_amount - fresh.current_amount))
          if (amount <= 0) continue
          // Claim the month first; only one writer can win this conditional update.
          let claim = supabase.from('savings_goals').update({ last_auto_period: auto.period }).eq('id', goal.id)
          claim = fresh.last_auto_period === null ? claim.is('last_auto_period', null) : claim.eq('last_auto_period', fresh.last_auto_period)
          const { data: claimed, error: claimError } = await claim.select('id')
          if (claimError || !claimed || claimed.length === 0) continue

          const next = Math.round((fresh.current_amount + amount) * 100) / 100
          const label = new Date(`${auto.period.slice(0, 7)}-01T12:00:00`).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
          const { error: insertError } = await supabase
            .from('goal_contributions')
            .insert({ goal_id: goal.id, user_id: user.id, amount, note: `Auto · ${label}` })
          if (insertError) {
            await supabase.from('savings_goals').update({ last_auto_period: fresh.last_auto_period }).eq('id', goal.id)
            continue
          }
          const { error: updateError } = await supabase
            .from('savings_goals')
            .update({ current_amount: next, ...completionPatch(fresh, next, fresh.target_amount) })
            .eq('id', goal.id)
          if (updateError) {
            await supabase.from('goal_contributions').delete().eq('goal_id', goal.id).eq('note', `Auto · ${label}`)
            await supabase.from('savings_goals').update({ last_auto_period: fresh.last_auto_period }).eq('id', goal.id)
            continue
          }
          total += amount
          count += 1
        } catch (err) {
          console.warn('Auto-contribution failed for', goal.name, err)
        }
      }
      if (count > 0) {
        void queryClient.invalidateQueries({ queryKey: goalsQueryKey(user.id) })
        void queryClient.invalidateQueries({ queryKey: ['goal_auto_applied'] })
        void queryClient.invalidateQueries({ queryKey: ['goal_contributions'] })
        void queryClient.invalidateQueries({ queryKey: ['savings_goal'] })
        toast.success(`Added ${formatCurrency(total)} to ${count} goal${count === 1 ? '' : 's'}`, {
          description: 'Tracked in Loot — remember to move the money into your savings.',
        })
      }
    })()
  }, [user, goals, auto, queryClient])

  return null
}
