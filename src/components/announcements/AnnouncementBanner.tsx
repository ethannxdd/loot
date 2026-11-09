import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight, Info, PartyPopper, TriangleAlert, X } from 'lucide-react'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useFeature } from '@/hooks/useFeatures'
import { supabase } from '@/lib/supabase'

export interface BannerAnnouncement {
  id: string
  title: string
  body: string
  link: string | null
  style: 'info' | 'good' | 'heads_up'
}

const STYLE = {
  info: { icon: Info, tone: 'bg-[color-mix(in_srgb,var(--chart-2)_12%,var(--surface))]', iconColor: 'var(--chart-2)' },
  good: { icon: PartyPopper, tone: 'bg-[var(--accent-tint)]', iconColor: 'var(--accent)' },
  heads_up: { icon: TriangleAlert, tone: 'bg-[color-mix(in_srgb,var(--caution)_12%,var(--surface))]', iconColor: 'var(--caution)' },
}

/** One announcement as a card (also used as the admin composer's preview). */
export function AnnouncementCard({ a, onDismiss, onOpen }: { a: BannerAnnouncement; onDismiss: () => void; onOpen: () => void }) {
  const s = STYLE[a.style] ?? STYLE.info
  const Icon = s.icon
  return (
    <section className={`card flex items-start gap-3 !shadow-none ${s.tone}`} data-testid="announcement">
      <Icon size={20} style={{ color: s.iconColor }} className="mt-0.5 shrink-0" />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-semibold">{a.title}</p>
        <p className="text-[13.5px] text-muted-foreground">{a.body}</p>
        {a.link && (
          <span className="mt-1 inline-flex items-center text-[13px] font-semibold text-primary">
            Take a look <ChevronRight size={14} />
          </span>
        )}
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-fill">
        <X size={15} />
      </button>
    </section>
  )
}

/** Summary banner (§5.2, flag `announcements_banner`): live announcements for me; tracks seen / clicked / dismissed. */
export function AnnouncementBanner() {
  const on = useFeature('announcements_banner')
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const key = ['my_announcements', user?.id]
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_announcements')
      if (error) throw error
      return (data ?? []) as BannerAnnouncement[]
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silent: true },
  })
  const mark = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'seen' | 'clicked' | 'dismissed' }) => {
      await supabase.rpc('mark_announcement', { p_id: id, p_action: action })
    },
    onSuccess: (_d, v) => {
      if (v.action === 'dismissed') qc.setQueryData<BannerAnnouncement[]>(key, (old = []) => old.filter((x) => x.id !== v.id))
    },
  })
  const first = data[0]
  useEffect(() => {
    if (first) mark.mutate({ id: first.id, action: 'seen' })
    // Mark each banner seen once when it first shows.
  }, [first?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!on || !first) return null

  return (
    <AnnouncementCard
      a={first}
      onDismiss={() => mark.mutate({ id: first.id, action: 'dismissed' })}
      onOpen={() => {
        mark.mutate({ id: first.id, action: 'clicked' })
        if (first.link) void navigate({ to: first.link })
      }}
    />
  )
}
