import { useCreateAffordabilityCheck } from './useAffordabilityChecks'
import { useExpenses } from './useExpenses'
import { useGoals } from './useGoals'
import { useProfile } from './useProfile'
import { checkAffordability, disposableIncome, safetyBufferAmount, type AffordabilityResult } from '@/lib/money'

export interface CheckInput {
  itemName: string
  amount: number
  isRecurring: boolean
}

/**
 * Runs an affordability check against the user's live numbers (Business Rules 7 & 8) and saves it to
 * history. Shared by the Checker page and the Dashboard's quick-check card so both give the same answer.
 */
export function useRunAffordabilityCheck() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: goals = [] } = useGoals()
  const createCheck = useCreateAffordabilityCheck()

  function run({ itemName, amount, isRecurring }: CheckInput): AffordabilityResult | null {
    if (!profile) return null
    const disposable = disposableIncome(profile.net_income, expenses)
    const safetyBuffer = safetyBufferAmount(profile.net_income, profile.safety_buffer_pct)
    const savingsBalance = goals.filter((g) => !g.is_completed).reduce((sum, g) => sum + g.current_amount, 0)
    const emergencyFund = goals.find((g) => g.category === 'emergency_fund')?.target_amount

    const result = checkAffordability({
      itemName,
      amount,
      isRecurring,
      disposableIncome: disposable,
      safetyBuffer,
      savingsBalance,
      emergencyFundTarget: emergencyFund,
    })
    createCheck.mutate({
      item_name: itemName,
      amount,
      is_recurring: isRecurring,
      verdict: result.verdict,
      reasoning: result.reasoning,
      disposable_at_check: disposable,
      currency_code: profile.currency_code,
    })
    return result
  }

  return { run, ready: Boolean(profile), isSaving: createCheck.isPending }
}
