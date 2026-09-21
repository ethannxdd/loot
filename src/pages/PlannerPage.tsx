import { Calculator, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { DebtForm } from '@/components/planner/DebtForm'
import { DebtRow } from '@/components/planner/DebtRow'
import { DebtStrategyComparison } from '@/components/planner/DebtStrategyComparison'
import { PlanCard } from '@/components/planner/PlanCard'
import { PlanEditor } from '@/components/planner/PlanEditor'
import { Modal } from '@/components/ui/Modal'
import { useCreateDebt, useDebts, useDeleteDebt, useUpdateDebt } from '@/hooks/useDebts'
import {
  useCreatePlannerPlan,
  useDeletePlannerPlan,
  usePlannerPlans,
  useUpdatePlannerPlan,
} from '@/hooks/usePlannerPlans'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import type { Debt, PlannerPlan } from '@/lib/types'

export function PlannerPage() {
  const { data: plans = [], isLoading: plansLoading } = usePlannerPlans()
  const createPlan = useCreatePlannerPlan()
  const updatePlan = useUpdatePlannerPlan()
  const deletePlan = useDeletePlannerPlan()

  const { data: debts = [], isLoading: debtsLoading } = useDebts()
  const createDebt = useCreateDebt()
  const updateDebt = useUpdateDebt()
  const deleteDebt = useDeleteDebt()

  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [planModal, setPlanModal] = useState<'new' | PlannerPlan | null>(null)
  const [debtModal, setDebtModal] = useState<'new' | Debt | null>(null)
  const [extraPayment, setExtraPayment] = useState(profile?.debt_extra_payment ?? 0)

  return (
    <div className="animate-enter space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.025em]">Salary Planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Model salary scenarios and plan your way out of debt.
          </p>
        </div>
        <button type="button" onClick={() => setPlanModal('new')} className="btn btn-primary">
          <Plus size={16} strokeWidth={2} /> New plan
        </button>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Calculator size={18} strokeWidth={1.75} className="text-secondary" />
          <h2 className="text-lg font-bold">Salary plans</h2>
        </div>

        {plansLoading ? (
          <div className="skeleton h-40 rounded-2xl" />
        ) : plans.length === 0 ? (
          <div className="card-elevated flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <Calculator size={26} strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold">No plans yet.</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Model a new job offer, a raise, or a career change — phase by phase.
              </p>
            </div>
            <button type="button" onClick={() => setPlanModal('new')} className="btn btn-primary">
              Create a plan
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() => setPlanModal(plan)}
                onDelete={() => deletePlan.mutate(plan.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet size={18} strokeWidth={1.75} className="text-secondary" />
          <h2 className="text-lg font-bold">Debt payoff planner</h2>
        </div>

        <div className="card space-y-2">
          {debtsLoading ? (
            <div className="skeleton h-24 rounded-xl" />
          ) : debts.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">No debts added yet.</p>
          ) : (
            debts.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                onEdit={() => setDebtModal(debt)}
                onDelete={() => deleteDebt.mutate(debt.id)}
              />
            ))
          )}
          <button
            type="button"
            onClick={() => setDebtModal('new')}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            <Plus size={14} strokeWidth={2} /> Add debt
          </button>
        </div>

        <DebtStrategyComparison
          debts={debts}
          extraPayment={extraPayment}
          onExtraPaymentChange={(value) => {
            setExtraPayment(value)
            updateProfile.mutate({ debt_extra_payment: value })
          }}
          chosenStrategy={profile?.debt_strategy ?? null}
          isSaving={updateProfile.isPending}
          onChooseStrategy={(strategy) => updateProfile.mutate({ debt_strategy: strategy })}
        />
      </section>

      {planModal && (
        <Modal title={planModal === 'new' ? 'New plan' : 'Edit plan'} onClose={() => setPlanModal(null)}>
          <PlanEditor
            initial={planModal === 'new' ? undefined : planModal}
            isSubmitting={createPlan.isPending || updatePlan.isPending}
            onCancel={() => setPlanModal(null)}
            onSubmit={(values) => {
              if (planModal === 'new') {
                createPlan.mutate(values, { onSuccess: () => setPlanModal(null) })
              } else {
                updatePlan.mutate({ id: planModal.id, patch: values }, { onSuccess: () => setPlanModal(null) })
              }
            }}
          />
        </Modal>
      )}

      {debtModal && (
        <Modal title={debtModal === 'new' ? 'Add debt' : 'Edit debt'} onClose={() => setDebtModal(null)}>
          <DebtForm
            initial={debtModal === 'new' ? undefined : debtModal}
            submitLabel={debtModal === 'new' ? 'Add debt' : 'Save debt'}
            isSubmitting={createDebt.isPending || updateDebt.isPending}
            onCancel={() => setDebtModal(null)}
            onSubmit={(values) => {
              if (debtModal === 'new') {
                createDebt.mutate(values, { onSuccess: () => setDebtModal(null) })
              } else {
                updateDebt.mutate({ id: debtModal.id, patch: values }, { onSuccess: () => setDebtModal(null) })
              }
            }}
          />
        </Modal>
      )}
    </div>
  )
}
