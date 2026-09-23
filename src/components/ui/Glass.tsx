import { forwardRef, useEffect, type HTMLAttributes } from 'react'

/**
 * Liquid Glass surface for navigation chrome (see styles.css → "Liquid Glass").
 * Children render above the effect layers; pass shape/position classes via className.
 */
export const Glass = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { as?: 'div' | 'nav' | 'aside' | 'header' }>(
  function Glass({ as: Tag = 'div', className = '', children, ...rest }, ref) {
    return (
      <Tag ref={ref as never} className={`glass ${className}`} {...rest}>
        <span className="glass-effect" aria-hidden />
        <span className="glass-tint" aria-hidden />
        <span className="glass-shine" aria-hidden />
        {children}
      </Tag>
    )
  },
)

/**
 * The SVG lens used by `.glass-effect` in Chromium: a smooth displacement field that bends the blurred backdrop
 * like thick curved glass. Safari/Firefox can't filter a backdrop with an SVG filter, so they get blur + rim only
 * (`html[data-glass='refract']` is only set on Chromium).
 */
export function LiquidGlassDefs() {
  useEffect(() => {
    const ua = navigator.userAgent
    const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Safari\/(?!537)/.test(ua) && !/Firefox\//.test(ua)
    if (chromium) document.documentElement.dataset.glass = 'refract'
    return () => {
      delete document.documentElement.dataset.glass
    }
  }, [])
  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
      <defs>
        <filter id="lg-refract" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="28" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}
