import { Link } from '@tanstack/react-router'
import { ChevronLeft, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/Logo'

const POINTS = [
  'See what’s actually left after every debit order',
  'Ask “can I afford it?” before you buy',
  'SARS tax estimates and filing dates',
]

/**
 * Shared frame for the signed-out pages (sign in, onboarding, reset password).
 * Phones: a single centred column. Desktop: a dark brand panel on the left, the form on the right.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  back = true,
  aside,
  wide = false,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  /** Show the "Loot" back-to-home link (not on onboarding, where the user is already signed in). */
  back?: boolean
  /** Replaces the default brand panel content on desktop. */
  aside?: ReactNode
  wide?: boolean
}) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="object-card m-3 hidden w-[44%] max-w-[560px] flex-col justify-between !rounded-[28px] p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-[18px] font-bold">Loot</span>
        </div>
        {aside ?? (
          <div>
            <h2 className="text-[44px] leading-[1.02] font-bold tracking-[-0.04em]">
              Know your <span className="text-[#5CF0BD]">loot.</span>
            </h2>
            <ul className="mt-8 space-y-3.5">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[16px] text-white/80">
                  <CircleCheck size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-[#5CF0BD]" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[13px] text-white/45">Made for South Africa · Estimates, not financial advice</p>
      </aside>

      <main className="flex flex-1 flex-col px-5 py-6 sm:px-8">
        <div className="flex h-10 items-center">
          {back && (
            <Link to="/" className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-muted-foreground hover:text-foreground">
              <ChevronLeft size={18} strokeWidth={2.2} />
              <span className="lg:hidden">
                <Logo size={20} className="mr-1.5 inline align-[-4px]" />
              </span>
              Loot
            </Link>
          )}
        </div>
        <div className={`animate-enter mx-auto flex w-full flex-1 flex-col justify-center py-8 ${wide ? 'max-w-[440px]' : 'max-w-[380px]'}`}>
          <div className="mb-7">
            <h1 className="text-[32px] leading-[1.1] font-bold tracking-[-0.03em]">{title}</h1>
            {subtitle && <p className="mt-2 text-[16px] leading-relaxed text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
