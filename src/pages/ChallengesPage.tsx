import { Check, Flame, Loader2, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type Ref } from 'react'
import { toast } from 'sonner'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useFeature } from '@/hooks/useFeatures'
import { useAddContribution, useGoals } from '@/hooks/useGoals'
import { useSpendEntries } from '@/hooks/useSpendEntries'
import { useChallenges, useCheckIn, useCreateChallenge, useUpdateChallenge } from '@/hooks/useStayAhead'
import {
  autoCheckins,
  CHALLENGE_KINDS,
  CHALLENGE_TEMPLATES,
  dayKey,
  fiftyTwoWeekTotal,
  isAutoKind,
  isOver,
  nextWeekend,
  progress,
  streak,
  weekAmount,
  weekOf,
  type Challenge,
  type ChallengeKind,
  type Checkin,
} from '@/lib/challenges'
import { formatCurrency } from '@/lib/utils'

/** /challenges (§4.8): no-spend weekend, 52-week, cook at home, custom. Auto kinds tick themselves from the spend log. */
export function ChallengesPage() {
  const { data, isLoading } = useChallenges()
  const live = useFeature('live_cycle')
  const { data: entries = [] } = useSpendEntries()
  const checkIn = useCheckIn()
  const [creating, setCreating] = useState(false)
  const formRef = useRef<HTMLElement>(null)
  const challenges = data?.challenges ?? []
  const checkins = data?.checkins ?? []

  // Auto-checks run on open (and in notify-daily's morning run via the same rules).
  const pending = challenges.flatMap((c) =>
    autoCheckins(c, checkins, entries, new Date(), live).map((k) => ({ challenge_id: c.id, ...k, auto: true })),
  )
  const pendingKey = pending.map((p) => `${p.challenge_id}${p.day}`).join()
  useEffect(() => {
    if (pending.length > 0 && !checkIn.isPending) checkIn.mutate(pending)
    // Run once per new set of days.
  }, [pendingKey])

  const active = challenges.filter((c) => c.status === 'active')
  const done = challenges.filter((c) => c.status !== 'active')

  function open() {
    setCreating(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow="Stay ahead"
        title="Challenges"
        subtitle="Small, time-boxed habits. What you don’t spend can go straight into a goal."
        actions={
          <button type="button" onClick={open} className="btn btn-primary">
            <Plus size={16} strokeWidth={2.4} /> Start a challenge
          </button>
        }
      />
      {creating && <CreateChallengeSheet ref={formRef} onClose={() => setCreating(false)} />}
      {isLoading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : challenges.length === 0 && !creating ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-tint)] text-primary">
            <Flame size={26} strokeWidth={1.8} />
          </span>
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">No challenges yet</h2>
          <p className="max-w-sm text-[14px] text-muted-foreground">Try a no-spend weekend. If you log your spends, Loot ticks the days off for you.</p>
          <button type="button" onClick={open} className="btn btn-primary mt-1">
            <Plus size={16} strokeWidth={2.4} /> Start a challenge
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {active.map((c) => (
              <ChallengeCard key={c.id} challenge={c} checkins={checkins.filter((k) => k.challenge_id === c.id)} logging={live} />
            ))}
          </div>
          {done.length > 0 && (
            <div className="space-y-2">
              <h2 className="card-title px-1">Finished</h2>
              <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
                {done.map((c, i) => {
                  const p = progress(c, checkins)
                  return (
                    <li key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
                      <span className="truncate text-[14.5px]">{c.title}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {p.done}/{p.total} · {c.status === 'completed' ? 'Done' : 'Stopped'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ChallengeCard({ challenge: c, checkins, logging }: { challenge: Challenge; checkins: Checkin[]; logging: boolean }) {
  const checkIn = useCheckIn()
  const update = useUpdateChallenge()
  const addContribution = useAddContribution()
  const { data: goals = [] } = useGoals()
  const [goalId, setGoalId] = useState(c.goal_id ?? '')
  const p = progress(c, checkins)
  const s = streak(checkins)
  const today = dayKey(new Date())
  const todayDone = checkins.some((k) => k.day === today)
  const inRange = today >= c.starts_on && today <= c.ends_on
  const manual = !isAutoKind(c.kind) || !logging
  const week = c.kind === '52_week' ? weekOf(c) : 0
  const weekDone = c.kind === '52_week' && checkins.some((k) => k.day === dayKey(new Date(new Date(`${c.starts_on}T00:00:00`).getTime() + (week - 1) * 7 * 86_400_000)))
  const over = isOver(c)
  const saved = p.saved

  function markToday(success: boolean) {
    checkIn.mutate([{ challenge_id: c.id, day: today, success, amount_saved: success ? Number(c.settings.dailyTarget ?? 0) : 0 }])
  }

  function markWeek() {
    const day = dayKey(new Date(new Date(`${c.starts_on}T00:00:00`).getTime() + (week - 1) * 7 * 86_400_000))
    checkIn.mutate([{ challenge_id: c.id, day, success: true, amount_saved: weekAmount(week, c.settings.base ?? 10, c.settings.reverse) }], {
      onSuccess: () => toast.success(`Week ${week}: ${formatCurrency(weekAmount(week, c.settings.base ?? 10, c.settings.reverse))} saved`),
    })
  }

  function moveToGoal() {
    if (!goalId || saved <= 0) return
    addContribution.mutate(
      { goalId, amount: saved, note: c.title },
      {
        onSuccess: () => {
          update.mutate({ id: c.id, patch: { status: 'completed', goal_id: goalId } })
          toast.success(`${formatCurrency(saved)} moved into your goal`)
        },
      },
    )
  }

  const r = 22
  const circ = 2 * Math.PI * r
  return (
    <section className="card space-y-4" data-testid="challenge-card">
      <div className="flex items-center gap-4">
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--fill-2)" strokeWidth="5" />
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--chart-4)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${circ * p.fraction} ${circ}`} transform="rotate(-90 28 28)" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{c.title}</p>
          <p className="text-[13px] text-muted-foreground">
            {p.done} of {p.total} {c.kind === '52_week' ? 'weeks' : 'days'}
            {saved > 0 && ` · ${formatCurrency(saved)} saved`}
          </p>
        </div>
        {s > 0 && (
          <span className="flex items-center gap-1 text-[15px] font-bold text-[var(--chart-4)]" aria-label={`${s} in a row`}>
            <Flame size={18} /> {s}
          </span>
        )}
      </div>

      {!over && c.kind === '52_week' && (
        <button type="button" disabled={weekDone || checkIn.isPending} onClick={markWeek} className="btn btn-secondary w-full">
          {weekDone ? <><Check size={15} /> Week {week} saved</> : `Week ${week}: put away ${formatCurrency(weekAmount(week, c.settings.base ?? 10, c.settings.reverse))}`}
        </button>
      )}
      {!over && c.kind !== '52_week' && inRange && manual && !todayDone && (
        <div className="flex gap-2">
          <button type="button" disabled={checkIn.isPending} onClick={() => markToday(true)} className="btn btn-primary flex-1">
            <Check size={15} /> Done today
          </button>
          <button type="button" disabled={checkIn.isPending} onClick={() => markToday(false)} className="btn btn-ghost">
            <X size={15} /> Missed
          </button>
        </div>
      )}
      {!over && !manual && inRange && <p className="text-[13px] text-muted-foreground">Ticks itself from your spend log after each day.</p>}
      {!over && today < c.starts_on && <p className="text-[13px] text-muted-foreground">Starts {new Date(`${c.starts_on}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}.</p>}

      {(over || c.kind === '52_week') && saved > 0 && goals.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-fill p-3">
          <div className="min-w-40 flex-1">
            <Select aria-label="Goal" value={goalId} placeholder="Choose a goal" onValueChange={setGoalId} options={goals.filter((g) => !g.is_completed).map((g) => ({ value: g.id, label: g.name }))} />
          </div>
          <button type="button" disabled={!goalId || addContribution.isPending} onClick={moveToGoal} className="btn btn-primary">
            Move {formatCurrency(saved)} into it
          </button>
        </div>
      )}
      {over && (
        <button type="button" onClick={() => update.mutate({ id: c.id, patch: { status: 'completed' } })} className="btn btn-ghost !min-h-9 !text-[13px]">
          Finish
        </button>
      )}
    </section>
  )
}

function CreateChallengeSheet({ onClose, ref }: { onClose: () => void; ref: Ref<HTMLElement> }) {
  const create = useCreateChallenge()
  const [kind, setKind] = useState<ChallengeKind>('no_spend_weekend')
  const [title, setTitle] = useState(CHALLENGE_TEMPLATES.no_spend_weekend.title)
  const weekend = nextWeekend()
  const today = dayKey(new Date())
  const [start, setStart] = useState(weekend.start)
  const [days, setDays] = useState('30')
  const [base, setBase] = useState('10')
  const [reverse, setReverse] = useState(false)
  const [target, setTarget] = useState('')

  function pick(k: ChallengeKind) {
    setKind(k)
    setTitle(CHALLENGE_TEMPLATES[k].title)
    setStart(k === 'no_spend_weekend' ? weekend.start : today)
  }

  function submit() {
    const startDate = new Date(`${start}T00:00:00`)
    const length = kind === 'no_spend_weekend' ? 2 : kind === 'cook_at_home' ? 7 : kind === '52_week' ? 364 : Math.max(1, Math.min(365, Math.round(Number(days) || 30)))
    const end = dayKey(new Date(startDate.getTime() + (length - 1) * 86_400_000))
    create.mutate(
      {
        kind,
        title: title.trim() || CHALLENGE_TEMPLATES[kind].title,
        starts_on: start,
        ends_on: end,
        settings: kind === '52_week' ? { base: Number(base) || 10, reverse } : kind === 'custom' && Number(target) > 0 ? { dailyTarget: Number(target) } : {},
        goal_id: null,
      },
      {
        onSuccess: () => {
          toast.success('Challenge started')
          onClose()
        },
      },
    )
  }

  return (
    <InlineSheet ref={ref} title="Start a challenge" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CHALLENGE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => pick(k)}
              className={`rounded-2xl p-3.5 text-left transition-colors ${kind === k ? 'bg-[var(--accent-tint)] ring-2 ring-primary' : 'bg-fill hover:bg-fill-2'}`}
            >
              <span className="block text-[15px] font-semibold">{CHALLENGE_TEMPLATES[k].title}</span>
              <span className="block text-[13px] text-muted-foreground">{CHALLENGE_TEMPLATES[k].line}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="ch-title">
              Name
            </label>
            <input id="ch-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="ch-start">
              Starts
            </label>
            <input id="ch-start" type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} />
          </div>
          {kind === 'custom' && (
            <>
              <div>
                <label className="field-label" htmlFor="ch-days">
                  Days
                </label>
                <input id="ch-days" type="number" inputMode="numeric" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="ch-target">
                  Saved per day (optional)
                </label>
                <input id="ch-target" type="number" inputMode="decimal" min={0} value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
            </>
          )}
          {kind === '52_week' && (
            <>
              <div>
                <label className="field-label" htmlFor="ch-base">
                  Week 1 amount
                </label>
                <input id="ch-base" type="number" inputMode="decimal" min={1} value={base} onChange={(e) => setBase(e.target.value)} />
                <p className="mt-1 text-[12.5px] text-muted-foreground">{formatCurrency(fiftyTwoWeekTotal(Number(base) || 10))} by week 52</p>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-[14px]">
                  <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} /> Biggest weeks first
                </label>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={create.isPending} className="btn btn-primary flex-[2]">
            {create.isPending && <Loader2 size={16} className="animate-spin" />}
            Start
          </button>
        </div>
      </div>
    </InlineSheet>
  )
}
