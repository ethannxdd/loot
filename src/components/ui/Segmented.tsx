interface SegmentedProps<T extends string> {
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string }[]
  /** Accessible name for the group. */
  label: string
  /** Stretch to fill the container width (forms). */
  full?: boolean
  size?: 'sm' | 'md'
}

/** Apple segmented control. Single-select; renders as a radio group for assistive tech. */
export function Segmented<T extends string>({ value, onChange, options, label, full, size = 'md' }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`segmented ${full ? 'flex w-full' : ''}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`${full ? 'flex-1' : ''} ${size === 'md' ? '!min-h-9' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
