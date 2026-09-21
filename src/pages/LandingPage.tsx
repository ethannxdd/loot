import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  BarChart3,
  Calculator,
  FileSearch,
  Landmark,
  LayoutDashboard,
  Lock,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'One number that matters',
    body: 'Your disposable income, front and centre — not your bank balance, which includes money already spoken for.',
  },
  {
    icon: Wallet,
    title: 'Expenses, properly tracked',
    body: 'Fixed and variable costs, monthly-equivalent, so a quarterly bill and a weekly one compare fairly.',
  },
  {
    icon: Sparkles,
    title: 'Affordability Checker',
    body: "Before you commit to anything, check it against your safety buffer — recurring or once-off.",
  },
  {
    icon: FileSearch,
    title: 'Statement Analysis',
    body: 'Upload an FNB or Capitec statement and get an instant category breakdown — parsed entirely in your browser.',
  },
  {
    icon: Calculator,
    title: 'Salary Planner & debt payoff',
    body: 'Model income scenarios and compare avalanche vs snowball strategies with a real payoff timeline.',
  },
  {
    icon: Landmark,
    title: 'Tax Centre',
    body: 'SARS-accurate estimates, a deduction tracker, and your filing deadlines — built for the current tax year.',
  },
  {
    icon: Shield,
    title: 'Loot Score',
    body: 'A credit-health estimate you can calibrate against your real bureau score over time.',
  },
  {
    icon: Users,
    title: 'Household mode',
    body: 'Link up with a partner and see combined totals, each expense labelled with who owns it.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Tell Loot what comes in and goes out',
    body: 'Your income and your recurring expenses — it takes a few minutes.',
  },
  {
    n: '2',
    title: 'See your real number instantly',
    body: 'Disposable income, savings rate, and burn rate, calculated the moment you add something.',
  },
  {
    n: '3',
    title: 'Plan ahead with confidence',
    body: 'Forecasts, tax estimates, debt payoff timelines, and a monthly close that locks in what happened.',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-hairline bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="text-base font-bold">Loot</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="btn btn-ghost">
              Sign in
            </Link>
            <Link to="/auth" className="btn btn-primary">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="loot-gradient">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24">
          <div className="animate-enter space-y-6 text-center md:text-left">
            <h1 className="text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-background md:text-[56px]">
              Know your <span className="text-background">loot.</span>
            </h1>
            <p className="mx-auto max-w-md text-base font-medium text-background/80 md:mx-0 md:text-lg">
              Know your number before you spend it — how much money you actually have left this
              month, not your bank balance.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Link
                to="/auth"
                className="btn w-full bg-background text-foreground sm:w-auto"
                style={{ minWidth: 180 }}
              >
                Get started free
              </Link>
              <a href="#features" className="btn btn-ghost w-full !border-background/30 !text-background sm:w-auto">
                See what's inside
                <ArrowUpRight size={15} strokeWidth={2} />
              </a>
            </div>
          </div>

          <div className="animate-enter stagger-2 mx-auto w-full max-w-sm">
            <div className="card-elevated space-y-4 bg-background/95 p-5 backdrop-blur-xl">
              <div className="overline">This month</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-hairline bg-surface-2 p-3">
                  <p className="text-[10px] font-semibold text-text-muted">Available</p>
                  <p className="tnum mt-1 text-sm text-primary">R12,450</p>
                </div>
                <div className="rounded-xl border border-hairline bg-surface-2 p-3">
                  <p className="text-[10px] font-semibold text-text-muted">Going out</p>
                  <p className="tnum mt-1 text-sm text-secondary">R18,900</p>
                </div>
                <div className="rounded-xl border border-hairline bg-surface-2 p-3">
                  <p className="text-[10px] font-semibold text-text-muted">Coming in</p>
                  <p className="tnum mt-1 text-sm" style={{ color: '#5BC0EB' }}>
                    R31,350
                  </p>
                </div>
              </div>
              <div className="card-purple flex items-center gap-3 px-4 py-3">
                <TrendingUp size={18} strokeWidth={1.75} className="shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-bold">Balanced</p>
                  <p className="text-[11px] text-muted-foreground">Savings rate: 18%</p>
                </div>
              </div>
              <p className="text-center text-[10px] text-text-subtle">Illustrative — your dashboard, once you add your numbers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-xl text-center">
          <div className="overline">Everything, in one place</div>
          <h2 className="mt-2 text-[28px] font-bold tracking-[-0.02em] md:text-4xl">
            Built to answer one question, properly
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Every feature exists to make "how much do I actually have" a number you trust —
            not a guess.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card card-hover space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Icon size={19} strokeWidth={1.75} />
              </div>
              <p className="text-sm font-bold">{title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-hairline bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-xl text-center">
            <div className="overline">How it works</div>
            <h2 className="mt-2 text-[28px] font-bold tracking-[-0.02em] md:text-4xl">
              Three steps to your number
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="space-y-3 text-center md:text-left">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground md:mx-0">
                  {step.n}
                </div>
                <p className="text-base font-bold">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-xl text-center">
          <div className="overline">Built for South Africa</div>
          <h2 className="mt-2 text-[28px] font-bold tracking-[-0.02em] md:text-4xl">
            Made for how South Africans actually bank
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="card space-y-2 text-center">
            <Landmark size={22} strokeWidth={1.75} className="mx-auto text-secondary" />
            <p className="text-sm font-bold">SARS-accurate tax tables</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Updated for the current tax year, with real brackets, rebates, and thresholds.
            </p>
          </div>
          <div className="card space-y-2 text-center">
            <BarChart3 size={22} strokeWidth={1.75} className="mx-auto text-secondary" />
            <p className="text-sm font-bold">FNB & Capitec statement support</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Purpose-built parsers for the statement formats South Africans actually get.
            </p>
          </div>
          <div className="card space-y-2 text-center">
            <Lock size={22} strokeWidth={1.75} className="mx-auto text-secondary" />
            <p className="text-sm font-bold">Your transactions stay yours</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Statement parsing happens entirely in your browser — raw transactions never reach
              our servers.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="loot-gradient">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-5 py-16 text-center md:py-24">
          <Target size={36} strokeWidth={1.5} className="text-background" />
          <h2 className="text-[28px] font-bold tracking-[-0.02em] text-background md:text-4xl">
            Know your number before you spend it.
          </h2>
          <Link
            to="/auth"
            className="btn bg-background text-foreground"
            style={{ minWidth: 220 }}
          >
            Create your free account
          </Link>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 py-10 text-center md:flex-row md:justify-between md:px-8 md:text-left">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="text-sm font-bold">Loot</span>
          </div>
          <p className="text-xs text-text-subtle">Know your loot. Built for South Africa.</p>
        </div>
      </footer>
    </div>
  )
}
