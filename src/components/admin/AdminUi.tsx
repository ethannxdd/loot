import { Loader2, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { UserStatus } from '@/lib/admin'

/** A titled content card used across the portal. */
export function AdminCard({
  title,
  sub,
  right,
  children,
  className = '',
}: {
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card min-w-0 space-y-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {sub && <p className="mt-0.5 text-[13px] text-muted-foreground">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

/** Initials on a colour derived from the email, so the same person always gets the same colour. */
export function Avatar({ name, email, size = 34 }: { name?: string | null; email?: string | null; size?: number }) {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0] || '?'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  const ini = ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  const seed = (email ?? source).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7)
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `linear-gradient(135deg, hsl(${seed} 62% 60%), hsl(${(seed + 32) % 360} 58% 46%))`,
      }}
    >
      {ini}
    </span>
  )
}

export function StatusChip({ status }: { status: UserStatus }) {
  if (status === 'suspended') return <span className="chip chip-alert">Suspended</span>
  if (status === 'unconfirmed') return <span className="chip chip-caution">Unconfirmed</span>
  return <span className="chip chip-positive">Active</span>
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-[14px]">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="min-w-0 truncate text-right font-medium">{v}</span>
    </div>
  )
}

export function IconTile({ icon: Icon, color, size = 32 }: { icon: LucideIcon; color: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[9px] text-white"
      style={{ width: size, height: size, background: color }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.1} />
    </span>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/12 text-primary">
        <Icon size={28} strokeWidth={2} />
      </span>
      <p className="text-[20px] font-bold tracking-[-0.02em]">{title}</p>
      {children && <div className="max-w-sm text-[15px] text-muted-foreground">{children}</div>}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="text-[13px] font-medium text-alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  )
}

/**
 * Confirmation sheet for an admin action: says what will happen, optionally collects extra fields, and asks
 * for a reason (required for anything sensitive — it goes in the audit log). Errors show inline; the sheet
 * closes itself on success.
 */
export function ActionDialog({
  title,
  description,
  children,
  confirmLabel,
  destructive = false,
  reasonRequired = false,
  reasonPlaceholder = 'e.g. Asked by email on 8 Oct',
  canConfirm = true,
  onConfirm,
  onClose,
}: {
  title: string
  description: ReactNode
  children?: ReactNode
  confirmLabel: string
  destructive?: boolean
  reasonRequired?: boolean
  reasonPlaceholder?: string
  canConfirm?: boolean
  onConfirm: (reason: string) => Promise<unknown>
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const reasonOk = !reasonRequired || reason.trim().length >= 3

  async function submit() {
    setPending(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title={title} onClose={() => !pending && onClose()}>
      <div className="space-y-4" data-testid="action-dialog">
        <div className="text-[15px] leading-relaxed text-muted-foreground">{description}</div>
        {children}
        <div>
          <label className="field-label" htmlFor="admin-reason">
            Reason {reasonRequired ? '' : <span className="font-normal text-text-subtle">(optional)</span>}
          </label>
          <textarea
            id="admin-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            maxLength={500}
            className="w-full resize-none"
          />
          <p className="mt-1 text-[12.5px] text-text-subtle">Saved in the audit log.</p>
        </div>
        <ErrorNote error={error} />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={pending} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={pending || !reasonOk || !canConfirm}
            className={`btn flex-1 ${destructive ? 'btn-destructive' : 'btn-primary'}`}
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Small "Showing 1–25 of 248" + Previous/Next row. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const last = Math.max(0, Math.ceil(total / pageSize) - 1)
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
      <span className="tnum">
        {total === 0 ? 'Nothing to show' : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost !min-h-9 !px-3.5 !text-[13px]" disabled={page <= 0} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button type="button" className="btn btn-secondary !min-h-9 !px-3.5 !text-[13px]" disabled={page >= last} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
