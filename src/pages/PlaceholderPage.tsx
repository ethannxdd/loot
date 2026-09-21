import type { LucideIcon } from 'lucide-react'

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  description: string
}

/** Used for pages whose real feature build lands in a later phase. */
export function PlaceholderPage({ icon: Icon, title, description }: PlaceholderPageProps) {
  return (
    <div className="animate-enter flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <Icon size={32} strokeWidth={1.75} className="text-foreground" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-[28px] font-bold tracking-[-0.025em]">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="overline rounded-full border border-border bg-surface px-3 py-1.5">
        Coming in a later phase
      </span>
    </div>
  )
}
