import { Ban, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteSubscription, useToggleSubscriptionCancel } from '@/hooks/useSubscriptionReviews'
import { formatCurrency } from '@/lib/utils'
import type { SubscriptionReview } from '@/lib/types'

interface SubscriptionAuditProps {
  subscriptions: SubscriptionReview[]
}

export function SubscriptionAudit({ subscriptions }: SubscriptionAuditProps) {
  const toggleCancel = useToggleSubscriptionCancel()
  const remove = useDeleteSubscription()

  if (subscriptions.length === 0) {
    return null
  }

  const totalMonthly = subscriptions.filter((s) => !s.marked_cancel).reduce((sum, s) => sum + s.amount, 0)

  return (
    <div className="card !pb-2">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="card-title">Subscriptions found</h3>
        <span className="tnum text-[13px] font-semibold text-muted-foreground">{formatCurrency(totalMonthly)}/mo active</span>
      </div>
      <div className="divide-y divide-hairline">
        {subscriptions.map((sub) => (
          <div
            key={sub.id}
            className={`flex items-center justify-between gap-3 py-3 ${sub.marked_cancel ? 'opacity-60' : ''}`}
          >
            <div className="min-w-0">
              <p className={`truncate text-[15px] font-semibold ${sub.marked_cancel ? 'line-through' : ''}`}>{sub.service_name}</p>
              <p className="text-[12.5px] text-muted-foreground">
                {sub.marked_cancel ? 'Marked for cancellation' : `Last charged ${sub.last_charged ?? 'recently'}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tnum text-[15px] font-semibold">{formatCurrency(sub.amount)}</span>
              <button
                type="button"
                onClick={() =>
                  toggleCancel.mutate(
                    { id: sub.id, markedCancel: !sub.marked_cancel },
                    { onSuccess: () => toast(sub.marked_cancel ? `Keeping ${sub.service_name}` : `${sub.service_name} marked for cancellation`) },
                  )
                }
                className="btn btn-ghost !min-h-8 !px-3 !text-[13px]"
              >
                {sub.marked_cancel ? (
                  <>
                    <RotateCcw size={12} strokeWidth={1.75} /> Keep
                  </>
                ) : (
                  <>
                    <Ban size={12} strokeWidth={1.75} /> Cancel
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  remove.mutate(sub.id, { onSuccess: () => toast.success(`${sub.service_name} removed from the audit`) })
                }
                aria-label={`Remove ${sub.service_name}`}
                className="grid h-9 w-9 place-items-center rounded-full text-text-subtle hover:bg-fill hover:text-alert"
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
