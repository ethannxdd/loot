import { Megaphone, Plus, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ActionDialog, AdminCard, EmptyState, ErrorNote, KV } from '@/components/admin/AdminUi'
import { AnnouncementCard } from '@/components/announcements/AnnouncementBanner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { useAdminFlags, useAdminMe } from '@/hooks/useAdmin'
import { useAdminAnnouncements, useAnnouncementActions, useAnnouncementReach, useAnnouncementStats } from '@/hooks/useAdminV2'
import { formatDate, roleAtLeast } from '@/lib/admin'
import { describeAudience, type Announcement, type AnnouncementChannel, type AnnouncementStyle, type Audience } from '@/lib/admin-v2'

const ROUTES = ['/dashboard', '/spending', '/expenses', '/goals', '/stats', '/wishlist', '/tools', '/stokvels', '/splits', '/renewals', '/challenges', '/future', '/settings']

interface Draft {
  id?: string
  title: string
  body: string
  link: string
  style: AnnouncementStyle
  channels: AnnouncementChannel[]
  audienceMode: 'all' | 'segment' | 'one'
  audience: Audience
  when: 'now' | 'later'
  starts_at: string
  ends_at: string
}

const EMPTY: Draft = { title: '', body: '', link: '/dashboard', style: 'info', channels: ['banner'], audienceMode: 'all', audience: { all: true }, when: 'now', starts_at: '', ends_at: '' }

function toDraft(a: Announcement): Draft {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    link: a.link ?? '',
    style: a.style,
    channels: a.channels,
    audienceMode: a.audience.user_id ? 'one' : a.audience.all ? 'all' : 'segment',
    audience: a.audience,
    when: a.starts_at ? 'later' : 'now',
    starts_at: a.starts_at ? a.starts_at.slice(0, 16) : '',
    ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '',
  }
}

/** SAST datetime-local → ISO. */
const sast = (local: string) => (local ? new Date(`${local}:00+02:00`).toISOString() : '')

/** /admin/announcements (§5.2): composer with audience, live reach, previews; list with stats. */
export function AdminAnnouncementsPage() {
  const { data: me } = useAdminMe()
  const { data: list = [], isLoading, error } = useAdminAnnouncements()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const canWrite = roleAtLeast(me?.role, 'support')
  const groups: Record<string, Announcement[]> = { Draft: [], Scheduled: [], Live: [], Ended: [] }
  for (const a of list) groups[a.status === 'draft' ? 'Draft' : a.status === 'scheduled' ? 'Scheduled' : a.status === 'live' ? 'Live' : 'Ended'].push(a)

  return (
    <div className="animate-enter space-y-6" data-testid="admin-announcements">
      <PageHeader
        eyebrow="Admin · Engage"
        title="Announcements"
        subtitle="Tell people about new features or fixes — as a Summary banner, in the bell, or as a push."
        actions={canWrite && !draft ? <button type="button" className="btn btn-primary" onClick={() => setDraft(EMPTY)}><Plus size={15} /> New announcement</button> : undefined}
      />
      {draft && <Composer draft={draft} setDraft={setDraft} role={me?.role ?? null} onDone={() => setDraft(null)} />}
      {error ? (
        <p role="alert" className="card text-[15px] font-medium text-alert">{error.message}</p>
      ) : isLoading ? (
        <div className="skeleton h-60 rounded-[22px]" />
      ) : list.length === 0 && !draft ? (
        <AdminCard title="Announcements">
          <EmptyState icon={Megaphone} title="Nothing sent yet">Write one to tell people what’s new.</EmptyState>
        </AdminCard>
      ) : (
        Object.entries(groups)
          .filter(([, items]) => items.length > 0)
          .map(([label, items]) => (
            <AdminCard key={label} title={label}>
              <ul className="-mx-2 divide-y divide-hairline">
                {items.map((a) => (
                  <li key={a.id} className="px-2 py-3">
                    <button type="button" onClick={() => (a.status === 'draft' && canWrite ? setDraft(toDraft(a)) : setSelected(selected === a.id ? null : a.id))} className="flex w-full items-center gap-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold">{a.title}</span>
                        <span className="block truncate text-[12.5px] text-muted-foreground">
                          {describeAudience(a.audience)} · {a.channels.join(', ')}
                          {a.sent_at ? ` · ${formatDate(a.sent_at, true)}` : ''}
                        </span>
                      </span>
                      {a.recipient_count != null && <span className="tnum text-[13px] text-muted-foreground">{a.recipient_count} reached · {a.clicked} clicked</span>}
                    </button>
                    {selected === a.id && <Stats id={a.id} />}
                  </li>
                ))}
              </ul>
            </AdminCard>
          ))
      )}
    </div>
  )
}

function Stats({ id }: { id: string }) {
  const { data } = useAnnouncementStats(id)
  if (!data) return <div className="skeleton mt-2 h-24 rounded-xl" />
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-6 rounded-xl bg-fill px-3 sm:grid-cols-3">
      <KV k="Recipients" v={data.recipients} />
      <KV k="Seen" v={data.seen} />
      <KV k="Clicked" v={data.clicked} />
      <KV k="Dismissed" v={data.dismissed} />
      <KV k="Pushed" v={data.pushed} />
      <KV k="Push opened" v={data.push_clicked} />
    </div>
  )
}

function Composer({ draft, setDraft, role, onDone }: { draft: Draft; setDraft: (d: Draft | null) => void; role: string | null; onDone: () => void }) {
  const actions = useAnnouncementActions()
  const { data: flags = [] } = useAdminFlags()
  const audience: Audience = draft.audienceMode === 'all' ? { all: true } : draft.audienceMode === 'one' ? { user_id: draft.audience.user_id } : { ...draft.audience, all: undefined, user_id: undefined }
  const { data: reach } = useAnnouncementReach(audience)
  const [sending, setSending] = useState<string | null>(null)
  const [preview, setPreview] = useState<'light' | 'dark'>('light')
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const setAud = (patch: Partial<Audience>) => set({ audience: { ...draft.audience, ...patch } })
  const ownerNeeded = draft.audienceMode === 'all' || (reach ?? 0) >= 50
  const canSend = role === 'owner' || !ownerNeeded
  const valid = draft.title.trim().length > 0 && draft.title.length <= 60 && draft.body.trim().length > 0 && draft.body.length <= 240 && draft.channels.length > 0 && (draft.audienceMode !== 'one' || /^[0-9a-f-]{36}$/i.test(draft.audience.user_id ?? ''))

  async function save(): Promise<string> {
    const id = await actions.save.mutateAsync({
      id: draft.id,
      title: draft.title.trim(),
      body: draft.body.trim(),
      link: draft.link || null,
      style: draft.style,
      channels: draft.channels,
      audience,
      starts_at: draft.when === 'later' ? sast(draft.starts_at) : '',
      ends_at: sast(draft.ends_at),
    })
    set({ id })
    return id
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <AdminCard title={draft.id ? 'Edit draft' : 'New announcement'} className="lg:col-span-7">
        <div className="space-y-3">
          <div>
            <label className="field-label" htmlFor="an-title">Title <span className="font-normal text-text-subtle">{draft.title.length}/60</span></label>
            <input id="an-title" maxLength={60} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="an-body">Message <span className="font-normal text-text-subtle">{draft.body.length}/240</span></label>
            <textarea id="an-body" rows={3} maxLength={240} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="an-link">Opens</label>
              <Select id="an-link" value={draft.link || '/dashboard'} onValueChange={(v) => set({ link: v })} options={ROUTES.map((r) => ({ value: r, label: r }))} />
            </div>
            <div>
              <span className="field-label">Style</span>
              <Segmented full label="Style" value={draft.style} onChange={(v) => set({ style: v })} options={[{ value: 'info', label: 'Info' }, { value: 'good', label: 'Good news' }, { value: 'heads_up', label: 'Heads up' }]} />
            </div>
          </div>
          <div>
            <span className="field-label">Channels</span>
            <div className="flex flex-wrap gap-2">
              {(['banner', 'bell', 'push'] as const).map((c) => (
                <label key={c} className="flex items-center gap-2 rounded-xl bg-fill px-3 py-2 text-[14px]">
                  <input type="checkbox" checked={draft.channels.includes(c)} onChange={(e) => set({ channels: e.target.checked ? [...draft.channels, c] : draft.channels.filter((x) => x !== c) })} />
                  {c === 'banner' ? 'Banner on Summary' : c === 'bell' ? 'Bell notification' : 'Push'}
                </label>
              ))}
            </div>
            {draft.channels.includes('push') && <p className="mt-1 text-[12.5px] text-muted-foreground">Push respects people’s “News from Loot” switch, quiet hours and the 3-a-day limit.</p>}
          </div>
          <div>
            <span className="field-label">Audience</span>
            <Segmented label="Audience" value={draft.audienceMode} onChange={(v) => set({ audienceMode: v })} options={[{ value: 'all', label: 'Everyone' }, { value: 'segment', label: 'A segment' }, { value: 'one', label: 'One person' }]} />
            {draft.audienceMode === 'one' && (
              <input className="mt-2" placeholder="User id (from the Users page)" value={draft.audience.user_id ?? ''} onChange={(e) => setAud({ user_id: e.target.value.trim() })} aria-label="User id" />
            )}
            {draft.audienceMode === 'segment' && (
              <div className="mt-2 grid grid-cols-1 gap-3 rounded-2xl bg-fill p-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  {(['browser', 'pwa', 'ios', 'android'] as const).map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-[13.5px]">
                      <input type="checkbox" checked={draft.audience.platforms?.includes(p) ?? false} onChange={(e) => setAud({ platforms: e.target.checked ? [...(draft.audience.platforms ?? []), p] : (draft.audience.platforms ?? []).filter((x) => x !== p) })} />
                      {p === 'pwa' ? 'Installed app' : p}
                    </label>
                  ))}
                </div>
                <Select aria-label="Has feature flag" value={draft.audience.flag ?? 'any'} onValueChange={(v) => setAud({ flag: v === 'any' ? undefined : v })} options={[{ value: 'any', label: 'Any flags' }, ...flags.map((f) => ({ value: f.key, label: `Has ${f.key}` }))]} />
                <Select aria-label="Onboarded" value={draft.audience.onboarded === undefined ? 'any' : draft.audience.onboarded ? 'yes' : 'no'} onValueChange={(v) => setAud({ onboarded: v === 'any' ? undefined : v === 'yes' })} options={[{ value: 'any', label: 'Onboarded or not' }, { value: 'yes', label: 'Onboarded' }, { value: 'no', label: 'Not onboarded' }]} />
                <div>
                  <label className="field-label" htmlFor="an-inactive">Inactive at least (days)</label>
                  <input id="an-inactive" type="number" min={0} value={draft.audience.inactive_days ?? ''} onChange={(e) => setAud({ inactive_days: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label" htmlFor="an-from">Signed up from</label>
                    <input id="an-from" type="date" value={draft.audience.signed_up_from ?? ''} onChange={(e) => setAud({ signed_up_from: e.target.value || undefined })} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="an-to">to</label>
                    <input id="an-to" type="date" value={draft.audience.signed_up_to ?? ''} onChange={(e) => setAud({ signed_up_to: e.target.value || undefined })} />
                  </div>
                </div>
              </div>
            )}
            <p className="mt-2 text-[13.5px]"><b className="tnum">{reach ?? '…'}</b> {reach === 1 ? 'person' : 'people'} will get this.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="field-label">When (SAST)</span>
              <Segmented full label="When" value={draft.when} onChange={(v) => set({ when: v })} options={[{ value: 'now', label: 'Now' }, { value: 'later', label: 'Later' }]} />
              {draft.when === 'later' && <input className="mt-2" type="datetime-local" value={draft.starts_at} onChange={(e) => set({ starts_at: e.target.value })} aria-label="Starts" />}
            </div>
            <div>
              <label className="field-label" htmlFor="an-end">Ends (optional)</label>
              <input id="an-end" type="datetime-local" value={draft.ends_at} onChange={(e) => set({ ends_at: e.target.value })} />
            </div>
          </div>
          <ErrorNote error={actions.save.error} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={onDone}>Close</button>
            <button type="button" className="btn btn-secondary" disabled={!valid || actions.save.isPending} onClick={() => void save().then(() => toast.success('Draft saved'))}>Save draft</button>
            <button type="button" className="btn btn-primary" disabled={!valid || !canSend} onClick={() => void save().then((id) => setSending(id))}>
              {draft.when === 'later' ? 'Schedule' : 'Send'}
            </button>
          </div>
          {!canSend && <p className="text-[12.5px] text-caution">Sending to everyone or 50+ people needs an Owner. Save the draft and ask one.</p>}
        </div>
      </AdminCard>
      <AdminCard title="Preview" className="lg:col-span-5" right={<Segmented size="sm" label="Preview theme" value={preview} onChange={setPreview} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />}>
        {draft.channels.includes('banner') && (
          <div data-theme={preview} className="rounded-2xl bg-background p-3" style={{ colorScheme: preview }}>
            <AnnouncementCard a={{ id: 'preview', title: draft.title || 'Title', body: draft.body || 'Your message', link: draft.link, style: draft.style }} onDismiss={() => undefined} onOpen={() => undefined} />
          </div>
        )}
        {draft.channels.includes('push') && (
          <div className="space-y-2">
            {(['iPhone', 'Android'] as const).map((d) => (
              <div key={d} className={`flex gap-3 rounded-2xl p-3 ${d === 'iPhone' ? 'bg-[#e9e9eb] text-black' : 'bg-[#202124] text-white'}`}>
                <img src="/icons/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 rounded-[9px]" />
                <div className="min-w-0 text-[13px]">
                  <p className="font-semibold">{draft.title || 'Title'}</p>
                  <p className="opacity-80">{draft.body || 'Your message'}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] opacity-60"><Smartphone size={11} /> {d} · Loot</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {draft.channels.length === 1 && draft.channels[0] === 'bell' && <p className="text-[13.5px] text-muted-foreground">Shows in the bell with the title and message.</p>}
      </AdminCard>
      {sending && (
        <ActionDialog
          title={draft.when === 'later' ? 'Schedule this announcement?' : 'Send this announcement?'}
          description={<p>It goes to <b>{reach ?? 0}</b> {reach === 1 ? 'person' : 'people'} ({describeAudience(audience)}) by {draft.channels.join(', ')}. Delivery runs every 5 minutes.</p>}
          confirmLabel={draft.when === 'later' ? 'Schedule' : 'Send'}
          reasonRequired
          reasonPlaceholder="e.g. Launching payday cycles"
          onConfirm={async (reason) => {
            await actions.send.mutateAsync({ id: sending, reason })
            toast.success('On its way')
            onDone()
          }}
          onClose={() => setSending(null)}
        />
      )}
    </div>
  )
}
