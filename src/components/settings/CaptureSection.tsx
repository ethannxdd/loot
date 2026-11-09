import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, CreditCard, ExternalLink, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { SettingsHeading } from '@/components/settings/SettingsHeading'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useAuth } from '@/hooks/useAuth'
import { useContent } from '@/hooks/useContent'
import { isIOS } from '@/lib/pwa'
import { supabase } from '@/lib/supabase'

interface KeyStatus {
  active: boolean
  created_at?: string
  last_used_at?: string | null
  total_uses?: number
}

const STEPS = [
  'Open the Shortcuts app and tap Automation, then the + button.',
  'Choose Transaction, pick your cards in Wallet, and choose Run Immediately.',
  'Tap Next, then New Blank Automation, and add the “Log to Loot” shortcut.',
  'Tap Done. Next time you tap your phone to pay, Loot logs it.',
]

/** Settings → Spending → Log Apple Pay spends automatically (§3.3, flag `apple_pay_capture`). */
export function CaptureSection() {
  const { user } = useAuth()
  const content = useContent()
  const queryClient = useQueryClient()
  const [key, setKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const statusKey = ['capture_key', user?.id]

  const { data: status, isLoading } = useQuery({
    queryKey: statusKey,
    queryFn: async (): Promise<KeyStatus> => {
      const { data, error } = await supabase.rpc('my_capture_key_status')
      if (error) throw error
      return data as KeyStatus
    },
    enabled: Boolean(user?.id),
    retry: false,
    meta: { silent: true },
  })

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_capture_key')
      if (error) throw error
      return data as string
    },
    onSuccess: (k) => {
      setKey(k)
      void queryClient.invalidateQueries({ queryKey: statusKey })
    },
  })

  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('revoke_capture_key')
      if (error) throw error
    },
    onSuccess: () => {
      setKey(null)
      setConfirmOff(false)
      toast.success('Apple Pay capture is off. The old key no longer works.')
      void queryClient.invalidateQueries({ queryKey: statusKey })
    },
  })

  async function copy() {
    if (!key) return
    try {
      await navigator.clipboard.writeText(key)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Couldn’t copy. Select the key and copy it yourself.')
    }
  }

  return (
    <section className="card space-y-4" data-testid="capture-section">
      <SettingsHeading
        icon={CreditCard}
        title="Log Apple Pay spends automatically"
        color="var(--chart-3)"
        description="Your iPhone’s Shortcuts app can send each tap-to-pay to Loot."
      />
      <p className="text-[13px] text-muted-foreground">
        Only the amount, the shop name and the time leave your phone — never your card or bank details. Android and Google
        Wallet can’t do this yet, so log by hand there.
      </p>

      {!isIOS() && !status?.active && (
        <p className="rounded-2xl bg-fill p-3.5 text-[13px] text-muted-foreground">Set this up on your iPhone or iPad.</p>
      )}

      {isLoading ? (
        <div className="skeleton h-16 rounded-2xl" />
      ) : key ? (
        <div className="space-y-3 rounded-2xl bg-fill p-4">
          <p className="text-[14px] font-semibold">1. Copy your capture key</p>
          <p className="text-[13px] text-muted-foreground">Shown once. Anyone with this key can add spends to your Loot.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-surface px-3 py-2.5 text-[13px]" data-testid="capture-key">
              {key}
            </code>
            <button type="button" onClick={() => void copy()} className="btn btn-secondary shrink-0 !min-h-10">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="pt-1 text-[14px] font-semibold">2. Get the Loot shortcut</p>
          {content.shortcut_url ? (
            <a href={content.shortcut_url} target="_blank" rel="noreferrer" className="btn btn-primary !min-h-10">
              Get “Log to Loot” <ExternalLink size={14} />
            </a>
          ) : (
            <p className="text-[13px] text-muted-foreground">The shortcut link isn’t published yet.</p>
          )}
          <p className="text-[13px] text-muted-foreground">When it asks, paste your capture key.</p>
          <p className="pt-1 text-[14px] font-semibold">3. Make it automatic</p>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      ) : status?.active ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-fill p-3.5">
            <div>
              <p className="text-[15px] font-medium">On</p>
              <p className="text-[13px] text-muted-foreground">
                {status.last_used_at
                  ? `Last capture ${new Date(status.last_used_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${status.total_uses ?? 0} so far`
                  : 'Waiting for your first capture'}
              </p>
            </div>
            <span className="chip chip-positive">Active</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className="btn btn-secondary">
              New key
            </button>
            <button type="button" onClick={() => setConfirmOff(true)} className="btn btn-ghost text-alert">
              Turn off
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className="btn btn-primary">
          {create.isPending && <Loader2 size={16} className="animate-spin" />}
          Create my capture key
        </button>
      )}

      {confirmOff && (
        <ConfirmModal
          title="Turn off Apple Pay capture?"
          confirmLabel="Turn off"
          isPending={revoke.isPending}
          onCancel={() => setConfirmOff(false)}
          onConfirm={() => revoke.mutate()}
        >
          <p>Your capture key stops working straight away. Spends already logged stay. You can create a new key any time.</p>
        </ConfirmModal>
      )}
    </section>
  )
}
