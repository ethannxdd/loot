import { useId } from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
}

/**
 * The v2 app icon: a Loot-green rounded square (continuous-corner squircle) with a white arrow
 * pointing up and to the right — money moving the right way.
 */
export function Logo({ size = 32, className }: LogoProps) {
  const gid = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Loot"
    >
      <defs>
        <linearGradient id={`lg${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1fcf93" />
          <stop offset="0.55" stopColor="#0a8f63" />
          <stop offset="1" stopColor="#066a4a" />
        </linearGradient>
      </defs>
      <path d="M0 18C0 8 8 0 18 0h28c10 0 18 8 18 18v28c0 10-8 18-18 18H18C8 64 0 56 0 46Z" fill={`url(#lg${gid})`} />
      <path
        d="M22 42 L42 22 M42 22 H28 M42 22 V36"
        stroke="#ffffff"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
