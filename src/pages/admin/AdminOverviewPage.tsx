import { Link } from '@tanstack/react-router'
import {
  Ban,
  Calculator,
  CalendarClock,
  ChevronRight,
  FileSearch,
  Gauge,
  Globe,
  Home,
  Landmark,
  Lock,
  Mail,
  Smartphone,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminCard, IconTile } from '@/components/admin/AdminUi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { StatStrip } from '@/components/ui/StatStrip'
import { useAdminOverview } from '@/hooks/useAdmin'
import { formatDate, type OverviewStats, type Platform } from '@/lib/admin'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'
import { INCOME_BRACKET_LABELS, type IncomeBracket } from '@/lib/money'

type Range = '7' | '30' | '90' | '0'
const RANGE_LABEL: Record<Range, string> = { '7': '7 days', '30': '30 days', '90': '90 days', '0': 'All time' }
// Spelled out: object keys that look like numbers iterate in numeric order, which would put 'All time' first.
const RANGES: Range[] = ['7', '30', '90', '0']

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

function shortDay(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

function Legend() {
  return (
    <div className="flex gap-4 text-[12.5px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} /> Sign-ups
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--chart-2)' }} /> Active users
      </span>
    </div>
  )
}

function GrowthChart({ series, height }: { series: OverviewStats['series']; height: number }) {
  const maxSignups = Math.max(1, ...series.map((s) => s.signups))
  const data = series.map((s) => ({ ...s, label: shortDay(s.day) }))
  const interval = Math.max(0, Math.ceil(data.length / 5) - 1)
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="adminActiveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis dataKey="label" tick={chartAxisTick} tickLine={false} axisLine={false} interval={interval} />
          <YAxis yAxisId="a" tick={chartAxisTick} tickLine={false} axisLine={false} allowDecimals={false} />
          {/* Sign-ups on their own hidden scale, kept to the lower third so they don't hide the active line. */}
          <YAxis yAxisId="s" orientation="right" hide domain={[0, maxSignups * 3]} />
          <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--fill)' }} />
          <Area yAxisId="a" type="monotone" dataKey="active" name="Active users" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#adminActiveFill)" />
          <Bar yAxisId="s" dataKey="signups" name="Sign-ups" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={10} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

const PLATFORMS: { key: Platform; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'browser', label: 'Browser', icon: Globe, color: 'var(--chart-7)' },
  { key: 'pwa', label: 'Installed app', icon: Smartphone, color: 'var(--chart-1)' },
  { key: 'ios', label: 'iOS app', icon: Smartphone, color: 'var(--chart-2)' },
  { key: 'android', label: 'Android app', icon: Smartphone, color: 'var(--chart-3)' },
]

function Platforms({ s }: { s: OverviewStats }) {
  const total = PLATFORMS.reduce((a, p) => a + s.platforms[p.key], 0)
  const signinTotal = s.signin.email + s.signin.google + s.signin.other
  const methods = [
    ['Email', s.signin.email],
    ['Google', s.signin.google],
    ...(s.signin.other ? [['Other', s.signin.other] as const] : []),
  ] as const
  return (
    <div className="space-y-4">
      {total > 0 ? (
        <div className="flex h-3 overflow-hidden rounded-full bg-fill">
          {PLATFORMS.filter((p) => s.platforms[p.key]).map((p) => (
            <div key={p.key} style={{ width: `${pct(s.platforms[p.key], total)}%`, background: p.color }} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-fill px-3 py-2 text-[13px] text-muted-foreground">No visits recorded in this period yet.</p>
      )}
      <ul className="space-y-2">
        {PLATFORMS.map(({ key, label, icon: Icon, color }) => (
          <li key={key} className="flex items-center gap-2.5 text-[13.5px]">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <Icon size={15} className="text-muted-foreground" />
            <span className="flex-1">{label}</span>
            {(key === 'ios' || key === 'android') && s.platforms[key] === 0 ? (
              <span className="chip chip-neutral">Not live</span>
            ) : (
              <span className="tnum font-semibold">{pct(s.platforms[key], total)}%</span>
            )}
          </li>
        ))}
      </ul>
      <div className="border-t border-hairline pt-3">
        <p className="mb-2 text-[12.5px] font-semibold text-muted-foreground">Sign-in method (all accounts)</p>
        <div className="flex gap-2">
          {methods.map(([label, n]) => (
            <div key={label} className="min-w-0 flex-1 rounded-xl bg-fill px-3 py-2">
              <p className="text-[12px] text-muted-foreground">{label}</p>
              <p className="tnum text-[16px] font-bold">{pct(n, signinTotal)}%</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-text-subtle">Email covers both password and email-link sign-ins.</p>
      </div>
    </div>
  )
}

function Funnel({ f }: { f: OverviewStats['funnel'] }) {
  const steps = [
    { l: 'Signed up', n: f.signed_up },
    { l: 'Confirmed email', n: f.confirmed },
    { l: 'Finished onboarding', n: f.onboarded },
    { l: 'Added an expense', n: f.first_expense },
    { l: '3 months of history', n: f.three_months },
  ]
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const p = pct(s.n, steps[0].n)
        const drop = i > 0 ? steps[i - 1].n - s.n : 0
        return (
          <div key={s.l}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="font-medium">{s.l}</span>
              <span className="tnum shrink-0 text-muted-foreground">
                <span className="font-semibold text-foreground">{s.n}</span> · {p}%
                {drop > 0 && <span className="ml-2 text-[12px] text-text-subtle">−{drop}</span>}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-fill">
              <div className="h-full rounded-full" style={{ width: `${p}%`, background: 'var(--accent)', opacity: 1 - i * 0.14 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const ADOPTION: { key: keyof OverviewStats['adoption']; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'expenses', label: 'Expenses', icon: Wallet, color: 'var(--chart-2)' },
  { key: 'goals', label: 'Goals', icon: Target, color: 'var(--chart-1)' },
  { key: 'checker', label: 'Can I afford it?', icon: Sparkles, color: 'var(--chart-4)' },
  { key: 'statements', label: 'Statements', icon: FileSearch, color: 'var(--chart-3)' },
  { key: 'planner', label: 'Salary planner', icon: Calculator, color: 'var(--chart-6)' },
  { key: 'tax', label: 'Tax centre', icon: Landmark, color: 'var(--chart-5)' },
  { key: 'close', label: 'Monthly close', icon: Lock, color: 'var(--chart-2)' },
  { key: 'bureau', label: 'Bureau score', icon: Gauge, color: 'var(--chart-6)' },
  { key: 'household', label: 'Household', icon: Home, color: 'var(--chart-7)' },
]

function Adoption({ s, compact }: { s: OverviewStats; compact?: boolean }) {
  const rows = ADOPTION.map((a) => ({ ...a, p: pct(s.adoption[a.key], s.adoption_total) }))
  return (
    <div className="space-y-3">
      {rows.slice(0, compact ? 5 : rows.length).map(({ key, label, icon, color, p }) => (
        <div key={key} className="flex items-center gap-3">
          <IconTile icon={icon} color={color} size={28} />
          <span className="w-[112px] shrink-0 truncate text-[13.5px] font-medium sm:w-[128px]">{label}</span>
          <div className="h-2 min-w-0 flex-1 rounded-full bg-fill">
            <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
          </div>
          <span className="tnum w-10 shrink-0 text-right text-[13px] font-semibold">{p}%</span>
        </div>
      ))}
    </div>
  )
}

function Attention({ a }: { a: OverviewStats['attention'] }) {
  const rows = [
    { icon: Mail, color: 'var(--caution)', title: 'Unconfirmed for 48h+', sub: 'The confirmation email may not have arrived', n: a.unconfirmed, filter: 'unconfirmed' as const },
    { icon: CalendarClock, color: 'var(--chart-4)', title: 'Stuck in onboarding', sub: 'Signed up 7+ days ago and never finished', n: a.stuck, filter: 'stuck' as const },
    {
      icon: Ban,
      color: 'var(--alert)',
      title: 'Suspended',
      sub: a.next_unsuspend ? `Next one ends ${formatDate(a.next_unsuspend)}` : 'Until lifted',
      n: a.suspended,
      filter: 'suspended' as const,
    },
  ]
  return (
    <div className="-my-1 divide-y divide-hairline">
      {rows.map((r) => (
        <Link key={r.title} to="/admin/users" search={{ filter: r.filter }} className="flex items-center gap-3 py-3">
          <IconTile icon={r.icon} color={r.color} size={36} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{r.title}</p>
            <p className="truncate text-[12.5px] text-muted-foreground">{r.sub}</p>
          </div>
          <span className="tnum text-[17px] font-bold">{r.n}</span>
          <ChevronRight size={16} className="text-text-subtle" />
        </Link>
      ))}
    </div>
  )
}

function Benchmarks({ b }: { b: OverviewStats['benchmarks'] }) {
  return (
    <div className="space-y-2.5">
      {(Object.keys(INCOME_BRACKET_LABELS) as IncomeBracket[]).map((k) => {
        const n = b[k] ?? 0
        return (
          <div key={k} className="flex items-center gap-3 text-[13.5px]">
            <span className="w-[92px] shrink-0 font-medium">{INCOME_BRACKET_LABELS[k]}</span>
            <div className="h-2 min-w-0 flex-1 rounded-full bg-fill">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (n / 50) * 100)}%`, background: n >= 50 ? 'var(--accent)' : 'var(--chart-2)' }} />
            </div>
            <span className="tnum w-14 shrink-0 text-right">
              {n >= 50 ? <span className="font-semibold text-primary">Live</span> : <span className="text-muted-foreground">{n}/50</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function AdminOverviewPage() {
  const [range, setRange] = useState<Range>('30')
  const { data: s, isLoading, error } = useAdminOverview(Number(range))
  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
  const label = range === '0' ? 'all time' : `last ${RANGE_LABEL[range]}`

  return (
    <div className="animate-enter space-y-6" data-testid="admin-overview">
      <PageHeader
        eyebrow={`Admin · ${today}`}
        title="Overview"
        subtitle="How Loot is doing. Counts only, never anyone’s money."
        actions={
          <Segmented<Range>
            label="Time range"
            value={range}
            onChange={setRange}
            options={RANGES.map((v) => ({ value: v, label: RANGE_LABEL[v] }))}
          />
        }
      />

      {error && (
        <p role="alert" className="card text-[15px] font-medium text-alert">
          {error.message}
        </p>
      )}

      {isLoading || !s ? (
        <div className="space-y-6">
          <div className="skeleton h-28 rounded-[22px]" />
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="skeleton h-72 rounded-[22px] lg:col-span-8" />
            <div className="skeleton h-72 rounded-[22px] lg:col-span-4" />
          </div>
        </div>
      ) : (
        <>
          {s.active_30d === 0 && (
            <p className="rounded-2xl bg-[var(--accent-tint)] px-4 py-3 text-[14px] text-foreground">
              Activity tracking starts with this release, so active-user numbers fill in from the first visit after it’s live.
              Sign-ups, the funnel and feature adoption already use existing data.
            </p>
          )}

          <StatStrip
            items={[
              {
                label: 'Users',
                value: s.users_total.toLocaleString('en-ZA'),
                sub: (
                  <span className={s.new_in_range > 0 ? 'text-primary' : undefined}>
                    +{s.new_in_range} {range === '0' ? 'in total' : `in ${RANGE_LABEL[range]}`}
                  </span>
                ),
              },
              { label: 'Active this week', value: s.active_7d.toLocaleString('en-ZA'), sub: `${pct(s.active_7d, s.users_total)}% of users` },
              {
                label: 'Active today',
                value: s.active_today.toLocaleString('en-ZA'),
                sub: s.peak_day ? `Peak ${s.peak_day.active} on ${new Date(`${s.peak_day.day}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'short' })}` : 'No visits this week',
              },
              {
                label: 'Installed app',
                value: s.active_in_range ? `${pct(s.platforms.pwa + s.platforms.ios + s.platforms.android, s.active_in_range)}%` : '—',
                sub: s.active_in_range ? `of active users, ${label}` : 'No visits yet',
                color: 'var(--accent)',
              },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-12">
            <AdminCard
              title="Growth"
              sub={range === '0' ? 'Sign-ups and active users per day, last 90 days' : 'Sign-ups and active users per day'}
              right={<Legend />}
              className="lg:col-span-8"
            >
              <div className="hidden sm:block">
                <GrowthChart series={s.series} height={240} />
              </div>
              <div className="sm:hidden">
                <GrowthChart series={s.series} height={180} />
              </div>
            </AdminCard>
            <AdminCard title="Platforms" sub={`Where people used Loot, ${label}`} className="lg:col-span-4">
              <Platforms s={s} />
            </AdminCard>
            <AdminCard title="Activation" sub={range === '0' ? 'Every account, step by step' : `Accounts created in the ${label}`} className="lg:col-span-6">
              <Funnel f={s.funnel} />
            </AdminCard>
            <AdminCard
              title="Feature adoption"
              sub={
                s.adoption_basis === 'active'
                  ? `Share of the ${s.adoption_total} people active in the ${label} who have used each feature`
                  : `Share of the ${s.adoption_total} onboarded users who have used each feature`
              }
              className="lg:col-span-6"
            >
              <Adoption s={s} />
            </AdminCard>
            <AdminCard title="Needs attention" sub="Tap to see the accounts" className="lg:col-span-7">
              <Attention a={s.attention} />
            </AdminCard>
            <AdminCard title="Benchmarks readiness" sub="Samples per income bracket · Stats → Benchmarks switches on at 50" className="lg:col-span-5">
              <Benchmarks b={s.benchmarks} />
            </AdminCard>
          </div>
        </>
      )}
    </div>
  )
}
