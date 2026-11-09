import { useMotionValueEvent, useReducedMotion, useSpring } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'

interface AnimatedNumberProps {
  value: number
  /** Renders the (in-between) number — e.g. formatCurrency, or a split symbol/number layout. */
  render: (n: number) => ReactNode
  /** Count up from this on first render (the payday moment). Default: start at `value`. */
  from?: number
}

/**
 * Number roll (§3.8): springs to a new value when it changes. Tabular digits come from the caller's `.tnum`.
 * With prefers-reduced-motion it just shows the value.
 */
export function AnimatedNumber({ value, render, from }: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const spring = useSpring(from ?? value, { stiffness: 120, damping: 22, mass: 0.9 })
  const [shown, setShown] = useState(from ?? value)

  useMotionValueEvent(spring, 'change', (v) => setShown(v))

  useEffect(() => {
    if (reduce) spring.jump(value)
    else spring.set(value)
  }, [value, reduce, spring])

  return <>{render(reduce ? value : Math.abs(shown - value) < 0.5 ? value : shown)}</>
}
