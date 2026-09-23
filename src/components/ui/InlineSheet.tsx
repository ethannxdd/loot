import { X } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'

interface InlineSheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Constrain the body width (forms). Default true. */
  narrow?: boolean
}

/**
 * The v2 inline add/edit surface: an elevated card with a large title and a round close button,
 * rendered in the page flow (never a popup — see LOOT-DESIGN-SYSTEM.md "Inline forms").
 */
export const InlineSheet = forwardRef<HTMLElement, InlineSheetProps>(function InlineSheet(
  { title, onClose, children, narrow = true },
  ref,
) {
  return (
    <section ref={ref} className="card-elevated animate-enter scroll-mt-6 space-y-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-muted-foreground hover:text-foreground"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      <div className={narrow ? 'max-w-2xl' : undefined}>{children}</div>
    </section>
  )
})
