import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'

export interface SelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  id?: string
  name?: string
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
  /** Matches the native <select>'s required styling hook — purely visual, Radix has no native validity. */
  required?: boolean
  /** Extra classes for the trigger — e.g. `!w-auto` for a compact, content-width picker. */
  className?: string
}

/**
 * A custom-styled dropdown that replaces the native <select> everywhere in the app. Built on
 * @radix-ui/react-select for correct keyboard nav (arrows, type-ahead, Home/End), focus
 * management and ARIA — only the visuals are ours. See LOOT-DESIGN-SYSTEM.md § Custom select.
 */
export function Select({
  value,
  onValueChange,
  options,
  id,
  name,
  placeholder,
  disabled,
  required,
  className = '',
  ...aria
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled} name={name} required={required}>
      <RadixSelect.Trigger id={id} className={`select-trigger ${className}`.trim()} aria-label={aria['aria-label']}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="shrink-0 text-text-muted">
          <ChevronDown size={16} strokeWidth={2} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="select-content" position="popper" sideOffset={6} align="start">
          <RadixSelect.ScrollUpButton className="select-scroll-btn">
            <ChevronUp size={14} strokeWidth={2} />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="select-viewport">
            {options.map((opt) => (
              <RadixSelect.Item key={opt.value} value={opt.value} disabled={opt.disabled} className="select-item">
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto flex shrink-0 items-center text-primary">
                  <Check size={14} strokeWidth={2.5} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="select-scroll-btn">
            <ChevronDown size={14} strokeWidth={2} />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
