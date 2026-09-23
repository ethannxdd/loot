import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  /** Small uppercase line above the title (date, section, context). */
  eyebrow?: ReactNode
  /** One-line description under the title. */
  subtitle?: ReactNode
  /** Buttons / controls, right-aligned on desktop and wrapping below on phones. */
  actions?: ReactNode
}

/** v2 page header — Apple "large title" with an optional eyebrow and trailing actions. */
export function PageHeader({ title, eyebrow, subtitle, actions }: PageHeaderProps) {
  return (
    <header data-tutorial="page-header" className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <div className="page-eyebrow mb-1">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  )
}
