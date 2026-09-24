import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
}

/**
 * The Loot app icon (Ethan's design, Sept 2026) — the same artwork as `public/icons/app-icon.svg`,
 * shown as a rounded square to match the home-screen icons. Swap the file in /public/icons to change it
 * everywhere: sidebar, mobile top bar, landing page, sign-in, error pages and PNG/PDF exports.
 */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <img
      src="/icons/app-icon.svg"
      width={size}
      height={size}
      alt="Loot"
      draggable={false}
      className={cn('shrink-0 select-none shadow-[0_0_0_0.5px_var(--border)]', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
    />
  )
}
