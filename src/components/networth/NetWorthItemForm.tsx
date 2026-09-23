import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import {
  NET_WORTH_ASSET_CATEGORIES,
  NET_WORTH_CATEGORY_LABELS,
  NET_WORTH_LIABILITY_CATEGORIES,
  type NetWorthItem,
  type NewNetWorthItem,
} from '@/lib/types'

interface NetWorthItemFormProps {
  initial?: Partial<NetWorthItem>
  isSubmitting?: boolean
  onSubmit: (values: NewNetWorthItem) => void
  onCancel?: () => void
}

export function NetWorthItemForm({ initial, isSubmitting, onSubmit, onCancel }: NetWorthItemFormProps) {
  const [kind, setKind] = useState<'asset' | 'liability'>(initial?.kind ?? 'asset')
  const categories = kind === 'asset' ? NET_WORTH_ASSET_CATEGORIES : NET_WORTH_LIABILITY_CATEGORIES
  const [category, setCategory] = useState(initial?.category ?? categories[0])
  const [label, setLabel] = useState(initial?.label ?? '')
  const [value, setValue] = useState(initial?.value?.toString() ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim() || !value) return
    onSubmit({ kind, category, label: label.trim(), value: Number(value) || 0 })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <Segmented
        full
        label="Type"
        value={kind}
        onChange={(k) => {
          setKind(k)
          setCategory(k === 'asset' ? NET_WORTH_ASSET_CATEGORIES[0] : NET_WORTH_LIABILITY_CATEGORIES[0])
        }}
        options={[
          { value: 'asset', label: 'Something I own' },
          { value: 'liability', label: 'Something I owe' },
        ]}
      />

      <div>
        <label className="field-label" htmlFor="nw-label">
          Name
        </label>
        <input id="nw-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Standard Bank savings" required autoFocus />
      </div>

      <div>
        <label className="field-label" htmlFor="nw-category">
          Category
        </label>
        <Select
          id="nw-category"
          value={category}
          onValueChange={(v) => setCategory(v as typeof category)}
          options={categories.map((c) => ({ value: c, label: NET_WORTH_CATEGORY_LABELS[c] }))}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="nw-value">
          Current value
        </label>
        <input id="nw-value" type="number" min={0} step={0.01} value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" required />
      </div>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
            Cancel
          </button>
        )}
        <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {initial ? 'Save' : 'Add item'}
        </button>
      </div>
    </form>
  )
}
