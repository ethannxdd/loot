import { Calculator, Plus, Wallet, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DebtForm } from '@/components/planner/DebtForm'
import { DebtRow } from '@/components/planner/DebtRow'
import { DebtStrategyComparison } from '@/components/planner/DebtStrategyComparison'
import { PlanCard } from '@/components/planner/PlanCard'
import { PlanEditor } from '@/components/planner/PlanEditor'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
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
  const [planToDelete, setPlanToDelete] = useState<PlannerPlan | null>(null)
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null)
  const [extraPayment, setExtraPayment] = useState(profile?.debt_extra_payment ?? 0)
  const planFormRef = useRef<HTMLElement>(null)
  const debtFormRef = useRef<HTMLElement>(null)

  // The saved extra payment may arrive after this page mounts; adopt it once, without overwriting typing.
  const adoptedExtra = useRef(Boolean(profile))
  useEffect(() => {
    if (profile && !adoptedExtra.current) {
      adoptedExtra.current = true
      setExtraPayment(profile.debt_extra_payment ?? 0)
    }
  }, [profile])

  useEffect(() => {
    if (planModal) planFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [planModal])

  useEffect(() => {
    if (debtModal) debtFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [debtModal])

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

        {planModal && (
          <section ref={planFormRef} className="card-elevated animate-enter space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{planModal === 'new' ? 'New plan' : 'Edit plan'}</h3>
              <button
                type="button"
                onClick={() => setPlanModal(null)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <PlanEditor
              key={planModal === 'new' ? 'new' : planModal.id}
              initial={planModal === 'new' ? undefined : planModal}
              isSubmitting={createPlan.isPending || updatePlan.isPending}
              onCancel={() => setPlanModal(null)}
              onSubmit={(values) => {
                if (planModal === 'new') {
                  createPlan.mutate(values, {
                    onSuccess: () => {
                      setPlanModal(null)
                      toast.success(`${values.name} created`)
                    },
                  })
                } else {
                  updatePlan.mutate(
                    { id: planModal.id, patch: values },
                    {
                      onSuccess: () => {
                        setPlanModal(null)
                        toast.success('Plan saved')
                      },
                    },
                  )
                }
              }}
            />
          </section>
        )}

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() => setPlanModal(plan)}
                onDelete={() => setPlanToDelete(plan)}
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
                onDelete={() => setDebtToDelete(debt)}
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

        {debtModal && (
          <section ref={debtFormRef} className="card-elevated animate-enter space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{debtModal === 'new' ? 'Add debt' : 'Edit debt'}</h3>
              <button
                type="button"
                onClick={() => setDebtModal(null)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <DebtForm
              key={debtModal === 'new' ? 'new' : debtModal.id}
              initial={debtModal === 'new' ? undefined : debtModal}
              submitLabel={debtModal === 'new' ? 'Add debt' : 'Save debt'}
              isSubmitting={createDebt.isPending || updateDebt.isPending}
              onCancel={() => setDebtModal(null)}
              onSubmit={(values) => {
                if (debtModal === 'new') {
                  createDebt.mutate(values, {
                    onSuccess: () => {
                      setDebtModal(null)
                      toast.success(`${values.name} added`)
                    },
                  })
                } else {
                  updateDebt.mutate(
                    { id: debtModal.id, patch: values },
                    {
                      onSuccess: () => {
                        setDebtModal(null)
                        toast.success('Debt saved')
                      },
                    },
                  )
                }
              }}
            />
          </section>
        )}

        <DebtStrategyComparison
          debts={debts}
          extraPayment={extraPayment}
          onExtraPaymentChange={setExtraPayment}
          onExtraPaymentCommit={(value) => {
            // Saved once editing finishes — not on every keystroke.
            if (value !== (profile?.debt_extra_payment ?? 0)) {
              updateProfile.mutate({ debt_extra_payment: value }, { onSuccess: () => toast.success('Extra payment saved') })
            }
          }}
          chosenStrategy={profile?.debt_strategy ?? null}
          isSaving={updateProfile.isPending}
          onChooseStrategy={(strategy) =>
            updateProfile.mutate(
              { debt_strategy: strategy },
              { onSuccess: () => toast.success(`${strategy === 'avalanche' ? 'Avalanche' : 'Snowball'} chosen as your strategy`) },
            )
          }
        />
      </section>

      {planToDelete && (
        <ConfirmModal
          title="Delete this plan?"
          confirmLabel="Delete plan"
          isPending={deletePlan.isPending}
          onCancel={() => setPlanToDelete(null)}
          onConfirm={() =>
            deletePlan.mutate(planToDelete.id, {
              onSuccess: () => {
                setPlanToDelete(null)
                toast.success(`${planToDelete.name} deleted`)
              },
            })
          }
        >
          <p>
            <span className="font-semibold text-foreground">{planToDelete.name}</span> and all its phases will be gone
            for good — this can't be undone.
          </p>
        </ConfirmModal>
      )}

      {debtToDelete && (
        <ConfirmModal
          title="Delete this debt?"
          confirmLabel="Delete debt"
          isPending={deleteDebt.isPending}
          onCancel={() => setDebtToDelete(null)}
          onConfirm={() =>
            deleteDebt.mutate(debtToDelete.id, {
              onSuccess: () => {
                setDebtToDelete(null)
                toast.success(`${debtToDelete.name} deleted`)
              },
            })
          }
        >
          <p>
            <span className="font-semibold text-foreground">{debtToDelete.name}</span> will be removed from your payoff
            plan. If you've paid it off — well done!
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}
