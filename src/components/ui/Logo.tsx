import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
}

/** Lime circle containing a bold black diagonal arrow pointing upper-right. */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Loot"
    >
      <circle cx="32" cy="32" r="32" fill="#C1FE72" />
      <path
        d="M20 44 L44 20 M44 20 H28 M44 20 V36"
        stroke="#0F0A0A"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
