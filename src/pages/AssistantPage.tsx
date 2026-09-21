import { Bot, Loader2, Plus, Send, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDebts } from '@/hooks/useDebts'
import { useExpenses } from '@/hooks/useExpenses'
import { useGoals } from '@/hooks/useGoals'
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useTaxProfile } from '@/hooks/useTaxProfile'
import {
  useAssistantConversations,
  useAssistantMessages,
  useCreateConversation,
  useDeleteConversation,
  useSendAssistantMessage,
} from '@/hooks/useAssistant'
import { buildFinancialContext } from '@/lib/assistant-context'

export function AssistantPage() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: snapshots = [] } = useSnapshots(1)
  const { data: debts = [] } = useDebts()
  const { data: goals = [] } = useGoals()
  const { data: taxProfile } = useTaxProfile()

  const { data: conversations = [] } = useAssistantConversations()
  const createConversation = useCreateConversation()
  const deleteConversation = useDeleteConversation()
  const [activeId, setActiveId] = useState<string | null>(null)
  const { data: messages = [] } = useAssistantMessages(activeId ?? undefined)
  const sendMessage = useSendAssistantMessage()

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id)
  }, [activeId, conversations])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const financialContext = buildFinancialContext({
    profile: profile ?? null,
    expenses,
    latestSnapshot: snapshots[snapshots.length - 1] ?? null,
    debts,
    goals,
    taxProfile: taxProfile ?? null,
  })

  async function handleNewConversation() {
    createConversation.mutate(undefined, { onSuccess: (conv) => setActiveId(conv.id) })
  }

  async function handleSend() {
    const text = input.trim()
    if (!text) return
    setError(null)

    let conversationId = activeId
    if (!conversationId) {
      const conv = await createConversation.mutateAsync(undefined)
      conversationId = conv.id
      setActiveId(conv.id)
    }

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setInput('')
    sendMessage.mutate(
      { conversationId, message: text, history, financialContext, isFirstMessage: messages.length === 0 },
      { onError: (err) => setError(err instanceof Error ? err.message : 'Something went wrong.') }
    )
  }

  return (
    <div className="animate-enter flex h-[calc(100dvh-160px)] gap-5 md:h-[calc(100dvh-120px)]">
      <aside className="hidden w-64 shrink-0 flex-col gap-2 md:flex">
        <button type="button" onClick={handleNewConversation} className="btn btn-secondary w-full">
          <Plus size={15} strokeWidth={2} /> New conversation
        </button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${
                c.id === activeId ? 'bg-surface-3 font-semibold' : 'text-muted-foreground hover:bg-white/[0.06]'
              }`}
            >
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
                className="shrink-0 rounded-full p-1 text-text-muted opacity-0 hover:bg-white/10 hover:text-alert group-hover:opacity-100"
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="card-elevated flex flex-1 flex-col overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Bot size={17} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-bold">Loot Assistant</p>
            <p className="text-xs text-text-muted">Grounded in your own numbers.</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Bot size={32} strokeWidth={1.5} className="text-text-muted" />
              <p className="text-sm text-muted-foreground">Ask about your budget, a purchase, or your tax situation.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-surface-2'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sendMessage.isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" /> Thinking…
              </div>
            </div>
          )}
          {error && <p className="text-center text-xs text-alert">{error}</p>}
        </div>

        <div className="flex items-end gap-2 border-t border-hairline px-4 py-3">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask Loot Assistant anything about your money…"
            className="max-h-32 flex-1 resize-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sendMessage.isPending || !input.trim()}
            aria-label="Send"
            className="btn btn-primary h-[44px] w-[44px] shrink-0 !p-0"
          >
            <Send size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
