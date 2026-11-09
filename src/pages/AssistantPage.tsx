import { useNavigate } from '@tanstack/react-router'
import { Bot, Loader2, Plus, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLogSpendSheet } from '@/context/LogSpendContext'
import { useContent } from '@/hooks/useContent'
import { useDebts } from '@/hooks/useDebts'
import { useWishlist } from '@/hooks/useDecide'
import { useExpenses } from '@/hooks/useExpenses'
import { useFeatureFlags } from '@/hooks/useFeatures'
import { useAssistantUsage, useTfsaContributions } from '@/hooks/useFuture'
import { useGoals } from '@/hooks/useGoals'
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useSafeToSpend } from '@/hooks/useSpendEntries'
import { useRenewals } from '@/hooks/useStayAhead'
import { useTaxProfile } from '@/hooks/useTaxProfile'
import {
  useAssistantConversations,
  useAssistantMessages,
  useCreateConversation,
  useDeleteConversation,
  useSendAssistantMessage,
} from '@/hooks/useAssistant'
import { buildFinancialContext } from '@/lib/assistant-context'
import { extractActions, type AssistantAction } from '@/lib/assistant-declarations'
import type { ToolData } from '@/lib/assistant-tools'

const SUGGESTED = ['Can I afford a R6,000 PS5?', 'Where did my money go this cycle?', 'How long would my savings last if I lost my job?', 'How much TFSA room do I have left?']

const ACTION_LABELS: Record<AssistantAction, string> = {
  wishlist: 'Add to wishlist',
  log: 'Log a spend',
  planner: 'Open the salary planner',
  checker: 'Run a full check',
  tools: 'Open the calculators',
}

/** /assistant — Ask Loot (§3.6), behind the `assistant` flag. Answers are grounded in tool results run here. */
export function AssistantPage() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: snapshots = [] } = useSnapshots(1)
  const { data: debts = [] } = useDebts()
  const { data: goals = [] } = useGoals()
  const { data: taxProfile } = useTaxProfile()
  const { data: tfsa = [] } = useTfsaContributions()
  const { data: wish = [] } = useWishlist()
  const { data: renewals = [] } = useRenewals()
  const { data: flags } = useFeatureFlags()
  const { data: usage } = useAssistantUsage()
  const content = useContent()
  const live = useSafeToSpend()
  const navigate = useNavigate()
  const { openLog } = useLogSpendSheet()

  const { data: conversations = [] } = useAssistantConversations()
  const createConversation = useCreateConversation()
  const deleteConversation = useDeleteConversation()
  const [activeId, setActiveId] = useState<string | null>(null)
  const { data: messages = [] } = useAssistantMessages(activeId ?? undefined)
  const sendMessage = useSendAssistantMessage()

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const limitReached = usage ? usage.used >= usage.cap : false

  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id)
  }, [activeId, conversations])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, sendMessage.isPending])

  const financialContext = buildFinancialContext({
    profile: profile ?? null,
    expenses,
    latestSnapshot: snapshots[snapshots.length - 1] ?? null,
    debts,
    goals,
    taxProfile: taxProfile ?? null,
    cycle: live.live ? live.cycle : null,
    safe: live.live ? live : null,
    wishlist: wish.filter((w) => w.status === 'waiting' || w.status === 'ready').map((w) => ({ name: w.name, price: w.price })),
    renewals: renewals.filter((r) => !r.ended_at).map((r) => ({ name: r.name, renews_on: r.renews_on })),
  })

  const toolData: ToolData | null = useMemo(
    () => (profile ? { profile, expenses, goals, entries: live.entries, payday: live.settings, tfsa, content } : null),
    [profile, expenses, goals, live.entries, live.settings, tfsa, content],
  )

  function runAction(a: AssistantAction) {
    if (a === 'log') return openLog()
    if (a === 'wishlist') return void navigate({ to: flags?.wishlist ? '/wishlist' : '/checker' })
    if (a === 'planner') return void navigate({ to: '/planner' })
    if (a === 'tools') return void navigate({ to: flags?.tools ? '/tools' : '/planner' })
    return void navigate({ to: '/checker' })
  }

  async function send(text: string) {
    if (!text.trim() || sendMessage.isPending) return
    setError(null)
    let conversationId = activeId
    if (!conversationId) {
      const conv = await createConversation.mutateAsync(undefined)
      conversationId = conv.id
      setActiveId(conv.id)
    }
    const history = messages.map((m) => ({ role: m.role, content: extractActions(m.content).text }))
    setInput('')
    sendMessage.mutate(
      { conversationId, message: text.trim(), history, financialContext, toolData, isFirstMessage: messages.length === 0 },
      { onError: (err) => setError(err instanceof Error ? err.message : 'Something went wrong.') },
    )
  }

  return (
    <div className="animate-enter flex h-[calc(100dvh-160px)] gap-5 md:h-[calc(100dvh-120px)]">
      <aside className="hidden w-64 shrink-0 flex-col gap-2 md:flex">
        <button type="button" onClick={() => createConversation.mutate(undefined, { onSuccess: (c) => setActiveId(c.id) })} className="btn btn-secondary w-full">
          <Plus size={15} strokeWidth={2} /> New conversation
        </button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {conversations.map((c) => (
            <div key={c.id} className={`group flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${c.id === activeId ? 'bg-surface-3 font-semibold' : 'text-muted-foreground hover:bg-fill'}`}>
              <button type="button" onClick={() => setActiveId(c.id)} className="min-w-0 flex-1 truncate text-left">
                {c.title}
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteConversation.mutate(c.id)
                  if (activeId === c.id) setActiveId(null)
                }}
                aria-label="Delete conversation"
                className="shrink-0 rounded-full p-1 text-text-muted opacity-0 hover:bg-fill hover:text-alert group-hover:opacity-100"
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
        {usage && <p className="px-1 text-[12px] text-muted-foreground">Today: {usage.used} of {usage.cap} questions</p>}
      </aside>

      <div className="card-elevated flex flex-1 flex-col overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Bot size={17} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Ask Loot</p>
            <p className="text-xs text-text-muted">Every figure is worked out from your own numbers.</p>
          </div>
          <button type="button" onClick={() => createConversation.mutate(undefined, { onSuccess: (c) => setActiveId(c.id) })} aria-label="New conversation" className="icon-btn md:hidden">
            <Plus size={17} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Bot size={32} strokeWidth={1.5} className="text-text-muted" />
              <p className="text-sm text-muted-foreground">Ask about a purchase, your cycle, your goals or your tax.</p>
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {SUGGESTED.map((s) => (
                  <button key={s} type="button" disabled={limitReached} onClick={() => void send(s)} className="chip chip-neutral !h-auto !py-2 !text-[13px] !whitespace-normal hover:bg-fill-2">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => {
            const { text, actions } = m.role === 'assistant' ? extractActions(m.content) : { text: m.content, actions: [] }
            return (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-surface-2'}`}>{text}</div>
                {actions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {actions.map((a) => (
                      <button key={a} type="button" onClick={() => runAction(a)} className="chip chip-positive !h-8 !px-3 !text-[12.5px]">
                        {ACTION_LABELS[a]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {sendMessage.isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" /> Working it out…
              </div>
            </div>
          )}
          {error && <p className="text-center text-xs text-alert">{error}</p>}
        </div>

        {limitReached ? (
          <p className="border-t border-hairline px-5 py-4 text-center text-[13.5px] text-muted-foreground">That’s it for today. Ask Loot resets at midnight.</p>
        ) : (
          <div className="flex items-end gap-2 border-t border-hairline px-4 py-3">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              placeholder="Ask about your money…"
              aria-label="Your question"
              className="max-h-32 flex-1 resize-none"
            />
            <button type="button" onClick={() => void send(input)} disabled={sendMessage.isPending || !input.trim()} aria-label="Send" className="btn btn-primary h-[44px] w-[44px] shrink-0 !p-0">
              <Send size={16} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
