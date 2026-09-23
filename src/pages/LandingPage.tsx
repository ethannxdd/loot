import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Calculator,
  ChartColumn,
  CircleAlert,
  CircleCheck,
  FileSearch,
  Gauge,
  Landmark,
  Lock,
  MapPin,
  Sparkles,
  Target,
  TriangleAlert,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { ScoreRing } from '@/components/score/ScoreRing'
import { Logo } from '@/components/ui/Logo'

/* Every figure on this page is illustrative and labelled as such — the page shows what the app does, not claims. */

const STEPS = [
  { title: 'Add what comes in and goes out', body: 'Your pay and your recurring costs. It takes about five minutes.' },
  { title: 'See what’s actually yours', body: 'Loot takes out every debit order, bill and saving, and shows what’s left.' },
  { title: 'Ask before you spend', body: 'Check any purchase against your real numbers and your safety buffer.' },
]

function Section({ id, eyebrow, title, children, className = '' }: { id?: string; eyebrow: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-6xl scroll-mt-20 px-5 py-16 md:px-8 md:py-24 ${className}`}>
      <div className="mx-auto max-w-2xl text-center">
        <p className="page-eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-[32px] leading-[1.08] font-bold tracking-[-0.03em] md:text-[48px]">{title}</h2>
      </div>
      {children}
    </section>
  )
}

/* ---------- Hero product composition ---------- */

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-5xl md:mt-20" aria-hidden>
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1.35fr_1fr]">
        {/* Can I afford it? */}
        <div className="object-card order-2 hidden p-5 md:order-1 md:block md:-rotate-2">
          <p className="text-[13px] font-semibold text-white/60">Can I afford it?</p>
          <p className="mt-3 text-[15px] font-semibold">PlayStation 5</p>
          <p className="tnum text-[26px] font-bold tracking-[-0.03em]">R 11,999</p>
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5">
            <TriangleAlert size={18} className="shrink-0 text-[#FFB340]" />
            <div>
              <p className="text-[14px] font-semibold">Tight</p>
              <p className="text-[12px] text-white/60">Leaves you below your emergency target</p>
            </div>
          </div>
        </div>

        {/* Available loot */}
        <div className="card-elevated order-1 p-6 md:order-2 md:p-7">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-muted-foreground">Available this month</p>
            <span className="chip chip-positive">Healthy</span>
          </div>
          <p className="tnum mt-2 text-[48px] leading-none font-bold tracking-[-0.045em] md:text-[56px]">R 6,883</p>
          <p className="mt-2 text-[14px] text-muted-foreground">
            About <span className="tnum font-semibold text-foreground">R 229 a day</span> for the 30 days left
          </p>
          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-fill">
            <span className="h-full" style={{ width: '21%', background: 'var(--accent)' }} />
            <span className="h-full" style={{ width: '63%', background: 'var(--chart-2)' }} />
            <span className="h-full" style={{ width: '16%', background: 'var(--chart-3)' }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
            {[
              ['Available', 'R 6,883', 'var(--accent)'],
              ['Committed', 'R 20,417', 'var(--chart-2)'],
              ['Growing', 'R 5,200', 'var(--chart-3)'],
            ].map(([l, v, c]) => (
              <div key={l}>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-[3px]" style={{ background: c }} />
                  {l}
                </p>
                <p className="tnum mt-0.5 text-[14px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Score + goal */}
        <div className="order-3 hidden space-y-4 md:block md:rotate-2">
          <div className="card-elevated flex items-center gap-4 p-5">
            <ScoreRing score={656} max={740} size={76} />
            <div>
              <p className="text-[13px] text-muted-foreground">Est. credit score</p>
              <p className="text-[18px] font-bold tracking-[-0.02em]">Good</p>
            </div>
          </div>
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-semibold">Emergency fund</span>
              <span className="tnum font-semibold text-primary">64%</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-fill-2">
              <div className="h-full w-[64%] rounded-full bg-primary" />
            </div>
            <p className="tnum mt-2 text-[12.5px] text-muted-foreground">R 24,800 of R 38,700</p>
          </div>
        </div>
      </div>
      <p className="mt-5 text-center text-[12px] text-text-subtle">Illustrative figures. Yours appear once you add your numbers.</p>
    </div>
  )
}

/* ---------- Bento tiles ---------- */

function PercentRing({ pct, size = 64 }: { pct: number; size?: number }) {
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <span className="tnum absolute inset-0 grid place-items-center text-[15px] font-bold">{pct}%</span>
    </div>
  )
}

function Tile({ icon: Icon, color, title, body, children, className = '' }: { icon: typeof Target; color: string; title: string; body: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`card flex flex-col gap-4 p-6 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: color }}>
          <Icon size={18} strokeWidth={2.1} />
        </span>
        <div>
          <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
      {children && <div className="mt-auto" aria-hidden>{children}</div>}
    </div>
  )
}

function Bento() {
  return (
    <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Checker — the hero feature */}
      <div className="object-card flex flex-col gap-5 p-6 sm:col-span-2 md:p-8">
        <div className="max-w-md">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white/12">
            <Sparkles size={18} strokeWidth={2.1} />
          </span>
          <h3 className="mt-4 text-[26px] leading-tight font-bold tracking-[-0.025em]">Can I afford it?</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-white/65">
            Type what you want to buy. Loot weighs it against what’s left, your savings and your safety buffer, then gives you a
            straight answer.
          </p>
        </div>
        <div className="mt-auto grid gap-2 sm:grid-cols-3" aria-hidden>
          {[
            { item: 'Gym contract', amt: 'R 459 /mo', verdict: 'Comfortable', Icon: CircleCheck, c: '#5CF0BD' },
            { item: 'PlayStation 5', amt: 'R 11,999', verdict: 'Tight', Icon: TriangleAlert, c: '#FFB340' },
            { item: 'New couch', amt: 'R 28,000', verdict: 'Not now', Icon: CircleAlert, c: '#FF6961' },
          ].map(({ item, amt, verdict, Icon, c }) => (
            <div key={item} className="rounded-2xl bg-white/9 p-3.5">
              <p className="text-[13px] text-white/60">{item}</p>
              <p className="tnum text-[17px] font-semibold">{amt}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: c }}>
                <Icon size={15} strokeWidth={2.2} /> {verdict}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Tile icon={FileSearch} color="var(--chart-4)" title="Statements, sorted" body="Drop in an FNB or Capitec statement and see where it went. Read on your device, never uploaded.">
        <div className="space-y-2.5">
          {[
            ['Groceries', 72, 'var(--chart-4)'],
            ['Transport', 48, 'var(--chart-3)'],
            ['Eating out', 31, 'var(--chart-5)'],
          ].map(([l, w, c]) => (
            <div key={l as string}>
              <p className="mb-1 text-[12.5px] text-muted-foreground">{l}</p>
              <div className="h-2 rounded-full bg-fill">
                <div className="h-full rounded-full" style={{ width: `${w}%`, background: c as string }} />
              </div>
            </div>
          ))}
        </div>
      </Tile>

      <Tile icon={Target} color="var(--accent)" title="Goals that fund themselves" body="Set a target and Loot shares your spare money between goals each month.">
        <div className="flex items-center gap-4">
          <PercentRing pct={64} />
          <div className="text-[13px]">
            <p className="font-semibold">Holiday</p>
            <p className="text-muted-foreground">On track for March</p>
          </div>
        </div>
      </Tile>

      <Tile icon={Landmark} color="var(--chart-2)" title="Tax centre" body="Estimates from SARS tax tables, a deduction tracker and every filing date that applies to you.">
        <div className="flex items-center gap-3">
          <div className="w-12 overflow-hidden rounded-xl bg-surface-2 text-center shadow-[0_0_0_1px_var(--hairline)]">
            <p className="bg-alert py-0.5 text-[10px] font-bold text-white">OCT</p>
            <p className="tnum py-1 text-[18px] font-bold">23</p>
          </div>
          <div className="text-[13px]">
            <p className="font-semibold">Filing deadline</p>
            <p className="text-muted-foreground">Non-provisional taxpayers</p>
          </div>
        </div>
      </Tile>

      <Tile icon={Calculator} color="var(--chart-5)" title="Salary & debt planner" body="Compare job offers after tax, and see when you’ll be debt-free with avalanche or snowball." />

      <Tile icon={Users} color="var(--chart-6)" title="Household mode" body="Link up with a partner to see combined numbers. You each keep your own view too." />

      <Tile icon={Gauge} color="var(--chart-3)" title="Loot Score" body="Rates your money habits, then tracks an estimated credit score once you add your real one from ClearScore or TransUnion." />

      <Tile
        icon={ChartColumn}
        color="var(--label-3)"
        title="Month-end forecast"
        body="See where you’re heading before the month ends, and how this month compares with the last six."
        className="sm:col-span-2 lg:col-span-1"
      />
    </div>
  )
}

/* ---------- Page ---------- */

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="topbar-material sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Loot home">
            <Logo size={28} />
            <span className="text-[17px] font-bold tracking-[-0.01em]">Loot</span>
          </Link>
          <nav className="flex items-center gap-1.5">
            <a href="#features" className="btn btn-ghost !hidden !bg-transparent md:!inline-flex">
              Features
            </a>
            <Link to="/auth" className="btn btn-ghost !bg-transparent">
              Sign in
            </Link>
            <Link to="/auth" search={{ mode: 'signup' }} className="btn btn-primary !min-h-9 !px-4 !text-[14px]">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="overflow-hidden px-5 pt-16 pb-8 md:px-8 md:pt-24">
        <div className="animate-enter mx-auto max-w-3xl text-center">
          <span className="chip chip-neutral">
            <MapPin size={13} strokeWidth={2.2} /> Made for South Africa
          </span>
          <h1 className="mt-5 text-[52px] leading-[0.98] font-bold tracking-[-0.045em] md:text-[88px]">
            Know your <span className="text-primary">loot.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[18px] leading-relaxed text-muted-foreground md:text-[21px]">
            See the money that’s actually yours this month, after rent, debit orders and savings. Not just your bank balance.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth" search={{ mode: 'signup' }} className="btn btn-primary w-full !min-h-12 !px-7 !text-[16px] sm:w-auto">
              Get started, it’s free <ArrowRight size={17} strokeWidth={2.2} />
            </Link>
            <a href="#how" className="btn btn-secondary w-full !min-h-12 !px-7 !text-[16px] sm:w-auto">
              How it works
            </a>
          </div>
        </div>
        <div className="animate-enter stagger-2">
          <HeroPreview />
        </div>
      </section>

      {/* Statement */}
      <section className="mx-auto max-w-4xl px-5 py-16 text-center md:px-8 md:py-24">
        <p className="text-[28px] leading-[1.25] font-semibold tracking-[-0.025em] text-text-subtle md:text-[40px]">
          Your bank balance includes money that’s already spoken for.{' '}
          <span className="text-foreground">Loot takes it out first, so the number you see is the number you can spend.</span>
        </p>
      </section>

      <Section id="features" eyebrow="Everything in one place" title="Built to answer one question properly.">
        <Bento />
      </Section>

      <Section id="how" eyebrow="How it works" title="Three steps to your number." className="!pt-4 md:!pt-8">
        <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-6">
              <span className="tnum grid h-10 w-10 place-items-center rounded-full bg-ink text-[16px] font-bold text-ink-foreground">{i + 1}</span>
              <h3 className="mt-4 text-[17px] font-semibold">{s.title}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8 md:pb-24">
        <div className="grid grid-cols-1 gap-6 border-t border-hairline pt-12 sm:grid-cols-3">
          {[
            { Icon: Landmark, t: 'SARS tax tables', b: 'Current-year brackets, rebates and thresholds.' },
            { Icon: FileSearch, t: 'FNB & Capitec statements', b: 'Built for the statements South Africans actually get.' },
            { Icon: Lock, t: 'Your transactions stay yours', b: 'Statements are read in your browser and never uploaded.' },
          ].map(({ Icon, t, b }) => (
            <div key={t} className="flex gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fill text-foreground">
                <Icon size={18} strokeWidth={2} />
              </span>
              <div>
                <p className="text-[15px] font-semibold">{t}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">{b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8 md:pb-24">
        <div className="object-card flex flex-col items-center gap-6 px-6 py-16 text-center md:py-20">
          <Logo size={56} />
          <h2 className="max-w-xl text-[32px] leading-[1.08] font-bold tracking-[-0.03em] md:text-[48px]">
            Know your number before you spend it.
          </h2>
          <Link to="/auth" search={{ mode: 'signup' }} className="btn !min-h-12 bg-white !px-7 !text-[16px] text-black hover:bg-white/90">
            Create your free account <ArrowRight size={17} strokeWidth={2.2} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 py-8 text-center md:flex-row md:justify-between md:px-8 md:text-left">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="text-[14px] font-bold">Loot</span>
          </div>
          <p className="text-[12.5px] text-text-subtle">Estimates and guidance only, not financial advice. Made in South Africa.</p>
        </div>
      </footer>
    </div>
  )
}
