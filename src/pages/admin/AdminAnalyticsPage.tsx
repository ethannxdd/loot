import { Download } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminCard, KV } from '@/components/admin/AdminUi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { StatStrip } from '@/components/ui/StatStrip'
import { useAdminAnalytics, type AnalyticsTab } from '@/hooks/useAdminV2'
import { formatDate } from '@/lib/admin'
import { downloadCsv, toCsv } from '@/lib/admin-v2'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'

type Range = '30' | '90' | '180' | '0'

interface Retention {
  cohort: string
  size: number
  weeks: { week: number; active: number }[] | null
}
interface Engagement {
  series: { day: string; dau: number; wau: number; mau: number }[]
  active_days: { days: number; users: number }[]
  platform_days: Record<string, number> | null
  loggers_wau: { loggers: number; wau: number }
}
interface Features {
  active: number
  features: { key: string; label: string; users: number }[]
  flags: Record<string, { global: boolean; overrides_on: number }>
}
interface Notifs {
  subscriptions: Record<string, number>
  subscribed_users: number
  active_30d: number
  by_kind: { kind: string; sent: number; failed: number; clicked: number }[]
  opt_outs: Record<string, number>
  announcements: { id: string; title: string; status: string; sent_at: string; recipients: number; seen: number; clicked: number }[]
}
interface Support {
  weekly: { week: string; problem: number; idea: number; question: number }[]
  open_now: number
  median_first_response_hours: number | null
  median_resolve_hours: number | null
  top_pages: { route: string; count: number }[]
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—')

/** /admin/analytics (§5.4): five tabs of counts (never money), each exportable as CSV. */
export function AdminAnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>('engagement')
  const [range, setRange] = useState<Range>('30')
  const days = Number(range)
  const { data, isLoading, error } = useAdminAnalytics<unknown>(tab, days)

  function exportCsv() {
    if (!data) return
    let rows: Record<string, unknown>[] = []
    if (tab === 'retention') rows = (data as Retention[]).flatMap((c) => (c.weeks ?? []).map((w) => ({ cohort: c.cohort, size: c.size, week: w.week, active: w.active })))
    if (tab === 'engagement') rows = (data as Engagement).series
    if (tab === 'features') rows = (data as Features).features.map((f) => ({ ...f, active: (data as Features).active }))
    if (tab === 'notifications') rows = (data as Notifs).by_kind
    if (tab === 'support') rows = (data as Support).weekly
    downloadCsv(`loot-analytics-${tab}-${new Date().toISOString().slice(0, 10)}`, toCsv(rows))
  }

  return (
    <div className="animate-enter space-y-6" data-testid="admin-analytics">
      <PageHeader
        eyebrow="Admin · Insights"
        title="Analytics"
        subtitle="Counts only — never anyone’s money."
        actions={
          <>
            <Segmented size="sm" label="Range" value={range} onChange={setRange} options={[{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '180', label: '180 days' }, { value: '0', label: 'All' }]} />
            <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!data}>
              <Download size={15} /> CSV
            </button>
          </>
        }
      />
      <div className="overflow-x-auto [&_button]:whitespace-nowrap">
        <Segmented label="Analytics" value={tab} onChange={setTab} options={[{ value: 'retention', label: 'Retention' }, { value: 'engagement', label: 'Engagement' }, { value: 'features', label: 'Features' }, { value: 'notifications', label: 'Notifications' }, { value: 'support', label: 'Support' }]} />
      </div>
      {error ? (
        <p role="alert" className="card text-[15px] font-medium text-alert">{error.message}</p>
      ) : isLoading || !data ? (
        <div className="skeleton h-80 rounded-[22px]" />
      ) : tab === 'retention' ? (
        <RetentionView rows={data as Retention[]} />
      ) : tab === 'engagement' ? (
        <EngagementView d={data as Engagement} />
      ) : tab === 'features' ? (
        <FeaturesView d={data as Features} />
      ) : tab === 'notifications' ? (
        <NotificationsView d={data as Notifs} />
      ) : (
        <SupportView d={data as Support} />
      )}
    </div>
  )
}

function RetentionView({ rows }: { rows: Retention[] }) {
  const weeks = Array.from({ length: 13 }, (_, i) => i)
  return (
    <AdminCard title="Weekly cohorts" sub="Share of each sign-up week that was active in week N after signing up.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead>
            <tr className="text-muted-foreground">
              <th className="pb-2 text-left">Cohort</th>
              <th className="pb-2 text-right">People</th>
              {weeks.map((w) => <th key={w} className="pb-2 text-center">W{w}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.cohort}>
                <td className="py-1 pr-2">{formatDate(c.cohort)}</td>
                <td className="tnum py-1 pr-2 text-right">{c.size}</td>
                {weeks.map((w) => {
                  const cell = c.weeks?.find((x) => x.week === w)
                  const share = cell && c.size > 0 ? cell.active / c.size : null
                  return (
                    <td key={w} className="p-0.5">
                      {share !== null && (
                        <span className="tnum block rounded-md py-1 text-center" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(share * 100)}%, var(--fill))`, color: share > 0.5 ? 'var(--accent-fg)' : undefined }}>
                          {Math.round(share * 100)}%
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  )
}

function EngagementView({ d }: { d: Engagement }) {
  const last = d.series.at(-1)
  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: 'Daily active', value: String(last?.dau ?? 0) },
          { label: 'Weekly active', value: String(last?.wau ?? 0) },
          { label: 'Stickiness (DAU ÷ MAU)', value: pct(last?.dau ?? 0, last?.mau ?? 0) },
          { label: 'Logged a spend this week', value: pct(d.loggers_wau.loggers, d.loggers_wau.wau), sub: `${d.loggers_wau.loggers} of ${d.loggers_wau.wau}` },
        ]}
      />
      <AdminCard title="Active people">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.series}>
              <CartesianGrid stroke="var(--hairline)" vertical={false} />
              <XAxis dataKey="day" tick={chartAxisTick} tickLine={false} axisLine={false} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="dau" name="Daily" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
              <Line dataKey="wau" name="Weekly" stroke="var(--chart-2)" dot={false} strokeWidth={2} />
              <Line dataKey="mau" name="Monthly" stroke="var(--chart-4)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </AdminCard>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard title="Active days per person">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.active_days}>
                <XAxis dataKey="days" tick={chartAxisTick} tickLine={false} axisLine={false} />
                <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="users" name="People" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>
        <AdminCard title="Installed app vs browser" sub="Active days by platform">
          <div className="divide-y divide-hairline">
            {Object.entries(d.platform_days ?? {}).map(([k, v]) => <KV key={k} k={k === 'pwa' ? 'Installed app' : k} v={v} />)}
          </div>
        </AdminCard>
      </div>
    </div>
  )
}

function FeaturesView({ d }: { d: Features }) {
  return (
    <AdminCard title="Phase 6 adoption" sub={`Share of ${d.active} active people who used each feature in the range`}>
      <ul className="divide-y divide-hairline">
        {d.features.map((f) => {
          const flag = d.flags?.[f.key]
          return (
            <li key={f.key} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 text-[14px] font-medium">{f.label}</span>
              <span className="text-[12px] text-muted-foreground">{flag ? (flag.global ? 'On for everyone' : `${flag.overrides_on} testing`) : ''}</span>
              <span className="tnum w-24 text-right text-[14px] font-semibold">{f.users} · {pct(f.users, d.active)}</span>
            </li>
          )
        })}
      </ul>
    </AdminCard>
  )
}

function NotificationsView({ d }: { d: Notifs }) {
  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: 'Push opt-in', value: pct(d.subscribed_users, d.active_30d), sub: `${d.subscribed_users} people` },
          ...Object.entries(d.subscriptions).map(([k, v]) => ({ label: k === 'pwa' ? 'Installed app' : k, value: String(v) })),
        ].slice(0, 4)}
      />
      <AdminCard title="Pushes by kind">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-[12px] text-muted-foreground"><th className="pb-2">Kind</th><th className="pb-2 text-right">Sent</th><th className="pb-2 text-right">Failed</th><th className="pb-2 text-right">Opened</th><th className="pb-2 text-right">Opt-outs</th></tr>
          </thead>
          <tbody>
            {d.by_kind.map((k) => (
              <tr key={k.kind} className="border-t border-hairline">
                <td className="py-2">{k.kind}</td>
                <td className="tnum py-2 text-right">{k.sent}</td>
                <td className="tnum py-2 text-right">{k.failed}</td>
                <td className="tnum py-2 text-right">{k.clicked} ({pct(k.clicked, k.sent)})</td>
                <td className="tnum py-2 text-right">{d.opt_outs[k.kind] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.by_kind.length === 0 && <p className="text-[13.5px] text-muted-foreground">No pushes sent in this range.</p>}
      </AdminCard>
      <AdminCard title="Announcements">
        <ul className="divide-y divide-hairline">
          {d.announcements.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
              <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
              <span className="tnum text-muted-foreground">{a.recipients} · seen {pct(a.seen, a.recipients)} · clicked {pct(a.clicked, a.recipients)}</span>
            </li>
          ))}
          {d.announcements.length === 0 && <li className="py-2 text-[13.5px] text-muted-foreground">None in this range.</li>}
        </ul>
      </AdminCard>
    </div>
  )
}

function SupportView({ d }: { d: Support }) {
  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: 'Open now', value: String(d.open_now) },
          { label: 'Median first reply', value: d.median_first_response_hours == null ? '—' : `${d.median_first_response_hours} h` },
          { label: 'Median to resolve', value: d.median_resolve_hours == null ? '—' : `${d.median_resolve_hours} h` },
        ]}
      />
      <AdminCard title="Feedback by week">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.weekly}>
              <XAxis dataKey="week" tick={chartAxisTick} tickLine={false} axisLine={false} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="problem" name="Problems" stackId="a" fill="var(--alert)" />
              <Bar dataKey="idea" name="Ideas" stackId="a" fill="var(--chart-4)" />
              <Bar dataKey="question" name="Questions" stackId="a" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AdminCard>
      <AdminCard title="Pages with the most problem reports">
        <div className="divide-y divide-hairline">
          {d.top_pages.map((p) => <KV key={p.route} k={p.route} v={p.count} />)}
          {d.top_pages.length === 0 && <p className="py-2 text-[13.5px] text-muted-foreground">None yet.</p>}
        </div>
      </AdminCard>
    </div>
  )
}
