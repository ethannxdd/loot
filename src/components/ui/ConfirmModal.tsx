import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from './Modal'

interface ConfirmModalProps {
  title: string
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as destructive (default true — this component exists for "are you sure?"). */
  destructive?: boolean
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** A small "are you sure?" dialog for anything that can't be undone. */
export function ConfirmModal({
  title,
  children,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-5">
        <div className="text-[15px] leading-relaxed text-muted-foreground">{children}</div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`btn flex-1 ${destructive ? 'btn-destructive' : 'btn-primary'}`}
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
