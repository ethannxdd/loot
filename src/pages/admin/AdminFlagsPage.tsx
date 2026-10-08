import { Link } from '@tanstack/react-router'
import { ChevronDown, Flag, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ActionDialog, AdminCard, Avatar, EmptyState, ErrorNote } from '@/components/admin/AdminUi'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { useAdminFlagOverrides, useAdminFlags, useAdminMe, useAdminUsers, useCreateFlag, useSetFlag, useSetOverride } from '@/hooks/useAdmin'
import { formatDate, roleAtLeast, type Flag as FlagT } from '@/lib/admin'

function AddOverride({ flagKey, onDone }: { flagKey: string; onDone: () => void }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<{ id: string; email: string | null } | null>(null)
  const [enabled, setEnabled] = useState<'on' | 'off'>('on')
  const [reason, setReason] = useState('')
  const setOverride = useSetOverride()
  const { data, isFetching } = useAdminUsers({ search: q.trim(), filter: 'all', platform: null, page: 0, pageSize: 5 })

  async function save() {
    if (!picked) return
    try {
      await setOverride.mutateAsync({ userId: picked.id, key: flagKey, enabled: enabled === 'on', reason })
      toast.success(`${flagKey} turned ${enabled} for ${picked.email}`)
      onDone()
    } catch {
      // shown below
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-fill p-3" data-testid="add-override">
      {picked ? (
        <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
          <Avatar email={picked.email} size={26} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{picked.email}</span>
          <button type="button" className="text-[13px] font-semibold text-primary" onClick={() => setPicked(null)}>
            Change
          </button>
        </div>
      ) : (
        <div>
          <div className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3">
            <Search size={15} className="text-text-subtle" />
            <input
              aria-label="Find a person"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a person by email or name"
              className="!h-auto min-w-0 flex-1 !border-0 !bg-transparent !p-0 !shadow-none !ring-0"
            />
            {isFetching && <Loader2 size={14} className="animate-spin text-text-subtle" />}
          </div>
          {q.trim().length >= 2 && data && (
            <div className="mt-2 divide-y divide-hairline overflow-hidden rounded-xl bg-surface">
              {data.rows.length === 0 && <p className="px-3 py-2.5 text-[13px] text-muted-foreground">No one matches.</p>}
              {data.rows.map((u) => (
                <button key={u.id} type="button" onClick={() => setPicked({ id: u.id, email: u.email })} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-fill">
                  <Avatar name={u.display_name} email={u.email} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{u.display_name || u.email}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{u.email}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<'on' | 'off'> label="Turn it" value={enabled} onChange={setEnabled} options={[{ value: 'on', label: 'On for them' }, { value: 'off', label: 'Off for them' }]} />
        <input aria-label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="min-w-0 flex-1 basis-[180px]" />
      </div>
      <ErrorNote error={setOverride.error} />
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn btn-ghost !min-h-9 !px-3.5 !text-[13px]">
          Cancel
        </button>
        <button type="button" disabled={!picked || setOverride.isPending} onClick={() => void save()} className="btn btn-primary !min-h-9 !px-3.5 !text-[13px]">
          {setOverride.isPending && <Loader2 size={14} className="animate-spin" />}
          Add override
        </button>
      </div>
    </div>
  )
}

function Overrides({ flag, canEdit }: { flag: FlagT; canEdit: boolean }) {
  const { data, isLoading } = useAdminFlagOverrides(flag.key)
  const setOverride = useSetOverride()
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-3 border-t border-hairline pt-3">
      {isLoading ? (
        <div className="skeleton h-12 rounded-xl" />
      ) : !data?.length ? (
        <p className="text-[13.5px] text-muted-foreground">Nobody has an override. Everyone follows the global setting.</p>
      ) : (
        <div className="divide-y divide-hairline rounded-2xl bg-fill px-3">
          {data.map((o) => (
            <div key={o.user_id} className="flex items-center gap-3 py-2.5">
              <Avatar name={o.display_name} email={o.email} size={30} />
              <Link to="/admin/users/$userId" params={{ userId: o.user_id }} className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{o.display_name || o.email}</span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {o.reason ? `“${o.reason}” · ` : ''}
                  {o.set_by_email ?? '—'} · {formatDate(o.created_at)}
                </span>
              </Link>
              <span className={`chip ${o.enabled ? 'chip-positive' : 'chip-neutral'}`}>{o.enabled ? 'On' : 'Off'}</span>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Remove override for ${o.email}`}
                  className="icon-btn"
                  onClick={() =>
                    setOverride
                      .mutateAsync({ userId: o.user_id, key: flag.key, enabled: null })
                      .then(() => toast.success('Override removed'))
                      .catch((e: Error) => toast.error(e.message))
                  }
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit &&
        (adding ? (
          <AddOverride flagKey={flag.key} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-ghost !min-h-9 !px-3.5 !text-[13px]">
            <Plus size={14} /> Add a person
          </button>
        ))}
    </div>
  )
}

function FlagCard({ flag, role }: { flag: FlagT; role: 'owner' | 'support' | 'viewer' }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<boolean | null>(null)
  const setFlag = useSetFlag()
  const isOwner = role === 'owner'
  const overrides = flag.overrides_on + flag.overrides_off

  return (
    <section className="card space-y-3" data-flag={flag.key}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[15px] font-semibold">{flag.key}</span>
            <span className={`chip ${flag.enabled_globally ? 'chip-positive' : 'chip-neutral'}`}>{flag.enabled_globally ? 'On for everyone' : 'Off for everyone'}</span>
            {flag.is_public && <span className="chip chip-neutral">Public</span>}
          </p>
          <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{flag.description}</p>
          <p className="mt-1.5 text-[12.5px] text-text-subtle">
            Changed {formatDate(flag.updated_at)}
            {flag.updated_by_email ? ` by ${flag.updated_by_email}` : ''}
          </p>
        </div>
        <Switch
          checked={flag.enabled_globally}
          onChange={(next) => isOwner && setConfirm(next)}
          disabled={!isOwner}
          label={`${flag.key} for everyone`}
        />
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-[13.5px] font-semibold text-primary" aria-expanded={open}>
        {overrides === 0 ? 'No per-person overrides' : `${overrides} per-person ${overrides === 1 ? 'override' : 'overrides'} (${flag.overrides_on} on, ${flag.overrides_off} off)`}
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <Overrides flag={flag} canEdit={roleAtLeast(role, 'support')} />}
      {confirm !== null && (
        <ActionDialog
          title={confirm ? `Turn ${flag.key} on for everyone?` : `Turn ${flag.key} off for everyone?`}
          description={
            confirm
              ? 'Everyone without an “off” override gets this feature the next time Loot loads.'
              : 'Everyone without an “on” override loses this feature the next time Loot loads.'
          }
          confirmLabel={confirm ? 'Turn on' : 'Turn off'}
          destructive={!confirm}
          onConfirm={(reason) => setFlag.mutateAsync({ key: flag.key, enabled: confirm, reason }).then(() => toast.success(`${flag.key} is ${confirm ? 'on' : 'off'} for everyone`))}
          onClose={() => setConfirm(null)}
        />
      )}
    </section>
  )
}

function NewFlag({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const create = useCreateFlag()
  return (
    <InlineSheet title="New feature flag" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create
            .mutateAsync({ key: key.trim(), description: description.trim(), isPublic })
            .then(() => {
              toast.success(`Flag ${key.trim()} created (off for everyone)`)
              onClose()
            })
            .catch(() => {})
        }}
      >
        <div>
          <label className="field-label" htmlFor="flag-key">
            Name
          </label>
          <input id="flag-key" required value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="e.g. rings_dashboard" className="font-mono" />
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">Lowercase letters, numbers and underscores. The code checks it with useFeature('{key || 'name'}').</p>
        </div>
        <div>
          <label className="field-label" htmlFor="flag-desc">
            What it does
          </label>
          <input id="flag-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. The Rings dashboard (Option C)" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-medium">Readable before sign-in</p>
            <p className="text-[13px] text-muted-foreground">Only for flags the sign-in or landing pages need.</p>
          </div>
          <Switch checked={isPublic} onChange={setIsPublic} label="Readable before sign-in" />
        </div>
        <ErrorNote error={create.error} />
        <button type="submit" disabled={create.isPending || key.trim().length < 2} className="btn btn-primary">
          {create.isPending && <Loader2 size={15} className="animate-spin" />}
          Create flag
        </button>
      </form>
    </InlineSheet>
  )
}

export function AdminFlagsPage() {
  const { data: flags, isLoading, error } = useAdminFlags()
  const { data: me } = useAdminMe()
  const role = me?.role ?? 'viewer'
  const [creating, setCreating] = useState(false)

  return (
    <div className="animate-enter space-y-6" data-testid="admin-flags">
      <PageHeader
        eyebrow="Admin · Controls"
        title="Feature flags"
        subtitle="Switch features on for everyone, or for chosen people, without a deploy."
        actions={
          role === 'owner' && !creating ? (
            <button type="button" onClick={() => setCreating(true)} className="btn btn-primary">
              <Plus size={16} /> New flag
            </button>
          ) : undefined
        }
      />
      {creating && <NewFlag onClose={() => setCreating(false)} />}
      {role !== 'owner' && (
        <p className="text-[13.5px] text-muted-foreground">
          {role === 'support' ? 'You can add per-person overrides. Only an Owner can change a flag for everyone.' : 'Your role can view flags but not change them.'}
        </p>
      )}
      {error ? (
        <p role="alert" className="card text-[15px] font-medium text-alert">
          {error.message}
        </p>
      ) : isLoading ? (
        <div className="skeleton h-40 rounded-[22px]" />
      ) : !flags?.length ? (
        <AdminCard title="Flags">
          <EmptyState icon={Flag} title="No flags yet" />
        </AdminCard>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {flags.map((f) => (
            <FlagCard key={f.key} flag={f} role={role} />
          ))}
        </div>
      )}
    </div>
  )
}
