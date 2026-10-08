import { Check, Download, Share, SquarePlus, Smartphone } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { SettingsHeading } from '@/components/settings/SettingsHeading'
import { useInstallState } from '@/hooks/useInstallState'
import { isIOS, isNativeShell, promptInstall } from '@/lib/pwa'

/**
 * "Loot on your phone": installs Loot as an app (PWA).
 * - Already installed → a quiet confirmation.
 * - Chromium (Android, desktop Chrome/Edge) → the browser's own install dialog.
 * - iPhone/iPad → there is no install dialog on iOS, so show the three Share-sheet steps inline.
 * - Anything else → point at the browser menu.
 * Hidden inside the Capacitor native app.
 */
export function InstallSection() {
  const { canPrompt, installed } = useInstallState()
  const [busy, setBusy] = useState(false)
  const ios = isIOS()

  if (isNativeShell()) return null

  async function install() {
    setBusy(true)
    const accepted = await promptInstall()
    setBusy(false)
    if (accepted) toast.success('Loot is on your home screen')
  }

  const description = installed
    ? 'You’re using the installed app.'
    : ios
      ? 'Add Loot to your Home Screen. It opens full screen, like any other app.'
      : 'Install Loot as an app. It opens in its own window and loads instantly.'

  return (
    <section className="card space-y-4" data-testid="install-section">
      <SettingsHeading
        icon={Smartphone}
        title="Install Loot"
        color="var(--chart-1)"
        description={description}
        trailing={
          installed ? (
            <span className="inline-flex shrink-0 items-center gap-1 pt-[3px] text-[13px] font-semibold text-primary">
              <Check size={15} strokeWidth={2.4} />
              Installed
            </span>
          ) : canPrompt ? (
            <button type="button" onClick={install} disabled={busy} className="btn btn-primary shrink-0">
              <Download size={15} strokeWidth={2} />
              Install
            </button>
          ) : undefined
        }
      />

      {!installed && !canPrompt && (
        <div className="border-t border-hairline pt-4">
          {ios ? (
            <ol className="space-y-3" aria-label="How to add Loot to your Home Screen">
              <Step n={1}>
                Tap <Inline icon={Share}>Share</Inline> in Safari’s toolbar.
              </Step>
              <Step n={2}>
                Scroll down and tap <Inline icon={SquarePlus}>Add to Home Screen</Inline>.
              </Step>
              <Step n={3}>
                Tap <span className="font-semibold text-foreground">Add</span>. Loot appears on your Home Screen.
              </Step>
            </ol>
          ) : (
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Open your browser’s menu and choose <span className="font-semibold text-foreground">Install app</span> or{' '}
              <span className="font-semibold text-foreground">Add to Home screen</span>.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[14px] leading-relaxed text-muted-foreground">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill text-[12px] font-semibold text-foreground tabular-nums">
        {n}
      </span>
      <span className="pt-[1px]">{children}</span>
    </li>
  )
}

function Inline({ icon: Icon, children }: { icon: typeof Share; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-foreground">
      <Icon size={15} strokeWidth={2.1} className="relative -top-px" aria-hidden />
      {children}
    </span>
  )
}
