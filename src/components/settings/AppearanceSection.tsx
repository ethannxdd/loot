import { Monitor, Moon, Sun, SunMoon } from 'lucide-react'
import { SettingsHeading } from '@/components/settings/SettingsHeading'
import { useTheme, type ThemePreference } from '@/context/ThemeContext'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/** Light / Dark / System. Saved on this device; "System" follows your phone or computer's setting. */
export function AppearanceSection() {
  const { preference, setPreference } = useTheme()
  return (
    <section className="card flex flex-wrap items-center justify-between gap-4">
      <SettingsHeading
        icon={SunMoon}
        title="Appearance"
        color="var(--chart-2)"
        description={preference === 'system' ? 'Matches your device’s light or dark setting.' : 'Saved on this device.'}
      />
      <div className="segmented" role="radiogroup" aria-label="Theme">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={preference === value}
            aria-pressed={preference === value}
            onClick={() => setPreference(value)}
            className="inline-flex items-center gap-1.5"
          >
            <Icon size={14} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}
