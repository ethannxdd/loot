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
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="overline">Subscription audit</p>
        <span className="tnum text-xs text-muted-foreground">{formatCurrency(totalMonthly)}/mo active</span>
      </div>
      <div className="space-y-2">
        {subscriptions.map((sub) => (
          <div
            key={sub.id}
            className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 ${
              sub.marked_cancel ? 'bg-alert/5 opacity-60' : 'bg-surface-2'
            }`}
          >
            <div>
              <p className="text-sm font-semibold">{sub.service_name}</p>
              <p className="text-xs text-muted-foreground">
                {sub.marked_cancel ? 'Marked for cancellation' : `Last charged ${sub.last_charged ?? 'recently'}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tnum text-sm">{formatCurrency(sub.amount)}</span>
              <button
                type="button"
                onClick={() =>
                  toggleCancel.mutate(
                    { id: sub.id, markedCancel: !sub.marked_cancel },
                    { onSuccess: () => toast(sub.marked_cancel ? `Keeping ${sub.service_name}` : `${sub.service_name} marked for cancellation`) },
                  )
                }
                className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
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
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-alert"
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
