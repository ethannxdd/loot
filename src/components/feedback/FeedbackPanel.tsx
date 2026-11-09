import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Segmented } from '@/components/ui/Segmented'
import { useAuth } from '@/hooks/useAuth'
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, type FeedbackKind, type FeedbackMessage, type FeedbackStatus } from '@/lib/admin-v2'
import { isStandalone } from '@/lib/pwa'
import { supabase } from '@/lib/supabase'

interface MyThread {
  id: string
  kind: FeedbackKind
  message: string
  status: FeedbackStatus
  unread: boolean
  created_at: string
  last_activity_at: string
}

/** What gets attached to a message — shown to the person before they send it. No money, no data. */
export function feedbackContext(extra: Record<string, string> = {}): Record<string, string> {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Other'
  const platform = /iPhone|iPad/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : isStandalone() ? 'pwa' : 'browser'
  return {
    route: window.location.pathname,
    app_version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
    platform,
    browser,
    theme: document.documentElement.dataset.theme ?? 'light',
    screen: `${window.innerWidth}×${window.innerHeight}`,
    ...extra,
  }
}

export function useMyFeedback(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my_feedback', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_feedback')
      if (error) throw error
      return (data ?? []) as MyThread[]
    },
    enabled: Boolean(user?.id) && enabled,
    staleTime: 30_000,
    retry: false,
    meta: { silent: true },
  })
}

/**
 * Settings → Support → Send feedback, and "Your messages" with replies (§5.3). Works while suspended (the RPCs are
 * allowed then), so it's also on the suspended screen.
 */
export function FeedbackPanel({ openThread, prefill }: { openThread?: string | null; prefill?: { kind?: FeedbackKind; message?: string; context?: Record<string, string> } }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: threads = [] } = useMyFeedback()
  const [view, setView] = useState<'new' | 'list' | string>(openThread ?? (prefill ? 'new' : 'list'))
  const [kind, setKind] = useState<FeedbackKind>(prefill?.kind ?? 'problem')
  const [message, setMessage] = useState(prefill?.message ?? '')
  const context = feedbackContext(prefill?.context)

  useEffect(() => {
    if (openThread) setView(openThread)
  }, [openThread])

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('send_feedback', { p_kind: kind, p_message: message.trim(), p_context: context })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setMessage('')
      setView('list')
      toast.success('Sent. Loot support will reply here and in your notifications.')
      void qc.invalidateQueries({ queryKey: ['my_feedback', user?.id] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Couldn’t send that.'),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (message.trim()) send.mutate()
  }

  if (view !== 'new' && view !== 'list') return <Thread id={view} onBack={() => setView('list')} />

  return (
    <div className="space-y-4" data-testid="feedback-panel">
      <Segmented
        label="Support"
        value={view === 'new' ? 'new' : 'list'}
        onChange={setView}
        options={[
          { value: 'new', label: 'Send feedback' },
          { value: 'list', label: `Your messages${threads.some((t) => t.unread) ? ' •' : ''}` },
        ]}
      />
      {view === 'new' ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="overflow-x-auto [&_button]:whitespace-nowrap">
            <Segmented label="Kind" value={kind} onChange={setKind} options={(Object.keys(FEEDBACK_KIND_LABEL) as FeedbackKind[]).map((k) => ({ value: k, label: FEEDBACK_KIND_LABEL[k] }))} />
          </div>
          <div>
            <label className="field-label" htmlFor="feedback-message">
              Message <span className="font-normal text-text-subtle">{message.length}/2000</span>
            </label>
            <textarea id="feedback-message" rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened, or what would make Loot better?" />
          </div>
          <details className="rounded-xl bg-fill px-3.5 py-2.5 text-[13px] text-muted-foreground">
            <summary className="cursor-pointer font-medium">Sent with your message</summary>
            <ul className="mt-2 space-y-0.5">
              {Object.entries(context).map(([k, v]) => (
                <li key={k}>
                  {k}: <span className="text-foreground">{v}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">Never your money or your data.</p>
          </details>
          <button type="submit" disabled={!message.trim() || send.isPending} className="btn btn-primary">
            {send.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
          </button>
        </form>
      ) : threads.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">No messages yet.</p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-fill">
          {threads.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setView(t.id)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14.5px] ${t.unread ? 'font-semibold' : ''}`}>{t.message.split('\n')[0]}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {FEEDBACK_KIND_LABEL[t.kind]} · {new Date(t.last_activity_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                  </span>
                </span>
                {t.unread && <span className="chip chip-positive">New reply</span>}
                <span className="chip chip-neutral">{FEEDBACK_STATUS_LABEL[t.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [reply, setReply] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['my_feedback_thread', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_feedback_thread', { p_id: id })
      if (error) throw error
      void qc.invalidateQueries({ queryKey: ['my_feedback', user?.id] })
      return data as { id: string; kind: FeedbackKind; status: FeedbackStatus; messages: FeedbackMessage[] }
    },
    staleTime: 10_000,
    retry: false,
  })
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reply_feedback', { p_id: id, p_body: reply.trim() })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setReply('')
      void qc.invalidateQueries({ queryKey: ['my_feedback_thread', id] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Couldn’t send that.'),
  })

  return (
    <div className="space-y-3" data-testid="feedback-thread">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[14px] font-semibold text-primary">
        <ArrowLeft size={15} /> Your messages
      </button>
      {isLoading || !data ? (
        <div className="skeleton h-32 rounded-xl" />
      ) : (
        <>
          <ul className="space-y-2.5">
            {data.messages.map((m) => (
              <li key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] whitespace-pre-wrap ${m.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-fill'}`}>{m.body}</div>
                <span className="mt-0.5 text-[11.5px] text-text-subtle">
                  {m.sender === 'user' ? 'You' : 'Loot support'} · {new Date(m.created_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input value={reply} maxLength={2000} onChange={(e) => setReply(e.target.value)} placeholder="Reply" aria-label="Reply" />
            <button type="button" onClick={() => send.mutate()} disabled={!reply.trim() || send.isPending} className="btn btn-primary shrink-0" aria-label="Send reply">
              <Send size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
