import { Calculator, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DebtForm } from '@/components/planner/DebtForm'
import { DebtRow } from '@/components/planner/DebtRow'
import { DebtStrategyComparison } from '@/components/planner/DebtStrategyComparison'
import { PlanCard } from '@/components/planner/PlanCard'
import { PlanEditor } from '@/components/planner/PlanEditor'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { PageHeader } from '@/components/ui/PageHeader'
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
      <PageHeader
        eyebrow="Planning"
        title="Salary planner"
        subtitle="Model salary scenarios and plan your way out of debt."
        actions={
          <button type="button" onClick={() => setPlanModal('new')} className="btn btn-primary" data-tutorial="planner-new">
            <Plus size={16} strokeWidth={2.4} /> New plan
          </button>
        }
      />

      <section className="space-y-4">
        <div className="px-1">
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Salary plans</h2>
          <p className="text-[13.5px] text-muted-foreground">What each scenario leaves you with every month, after tax and costs.</p>
        </div>

        {planModal && (
          <InlineSheet ref={planFormRef} title={planModal === 'new' ? 'New plan' : `Edit ${planModal.name}`} onClose={() => setPlanModal(null)} narrow={false}>
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
          </InlineSheet>
        )}

        {plansLoading ? (
          <div className="skeleton h-40 rounded-2xl" />
        ) : plans.length === 0 ? (
          <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/12 text-primary">
              <Calculator size={28} strokeWidth={1.8} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-[20px] font-bold tracking-[-0.02em]">No plans yet</h3>
              <p className="max-w-sm text-[14px] text-muted-foreground">
                Model a new job offer, a raise, or a career change — phase by phase.
              </p>
            </div>
            <button type="button" onClick={() => setPlanModal('new')} className="btn btn-primary">
              <Plus size={16} strokeWidth={2.4} /> Create a plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[22px] font-bold tracking-[-0.02em]">Debt payoff</h2>
            <p className="text-[13.5px] text-muted-foreground">Compare avalanche and snowball, and see when you&apos;ll be debt-free.</p>
          </div>
          <button type="button" onClick={() => setDebtModal('new')} className="btn btn-secondary">
            <Plus size={16} strokeWidth={2.4} /> Add debt
          </button>
        </div>

        <div className="card !px-4 !py-2">
          {debtsLoading ? (
            <div className="skeleton my-2 h-24 rounded-xl" />
          ) : debts.length === 0 ? (
            <p className="py-5 text-center text-[14px] text-muted-foreground">No debts added yet.</p>
          ) : (
            <div className="divide-y divide-hairline">
            {debts.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                onEdit={() => setDebtModal(debt)}
                onDelete={() => setDebtToDelete(debt)}
              />
            ))}
            </div>
          )}
        </div>

        {debtModal && (
          <InlineSheet ref={debtFormRef} title={debtModal === 'new' ? 'Add debt' : `Edit ${debtModal.name}`} onClose={() => setDebtModal(null)}>
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
          </InlineSheet>
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
