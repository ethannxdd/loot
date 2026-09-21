import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { DEBT_ACCOUNT_TYPES, DEBT_ACCOUNT_TYPE_LABELS, type Debt, type DebtAccountType, type NewDebt } from '@/lib/types'

interface DebtFormProps {
  initial?: Partial<Debt>
  isSubmitting?: boolean
  submitLabel?: string
  onSubmit: (values: NewDebt) => void
  onCancel?: () => void
}

export function DebtForm({ initial, isSubmitting, submitLabel = 'Add debt', onSubmit, onCancel }: DebtFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [accountType, setAccountType] = useState<DebtAccountType>(
    (initial?.account_type as DebtAccountType) ?? 'credit_card'
  )
  const [balance, setBalance] = useState(initial?.balance?.toString() ?? '')
  const [interestRate, setInterestRate] = useState(initial?.interest_rate?.toString() ?? '')
  const [minPayment, setMinPayment] = useState(initial?.min_payment?.toString() ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !balance) return
    onSubmit({
      name: name.trim(),
      account_type: accountType,
      balance: Number(balance) || 0,
      interest_rate: Number(interestRate) || 0,
      min_payment: Number(minPayment) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div>
        <label className="field-label" htmlFor="debt-name">
          Name
        </label>
        <input
          id="debt-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. FNB credit card"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="field-label" htmlFor="debt-type">
          Account type
        </label>
        <select id="debt-type" value={accountType} onChange={(e) => setAccountType(e.target.value as DebtAccountType)}>
          {DEBT_ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DEBT_ACCOUNT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="debt-balance">
          Current balance
        </label>
        <input
          id="debt-balance"
          type="number"
          min={0}
          step={0.01}
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="0"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="debt-rate">
            Interest rate (% p.a.)
          </label>
          <input
            id="debt-rate"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="debt-min-payment">
            Min. monthly payment
          </label>
          <input
            id="debt-min-payment"
            type="number"
            min={0}
            step={0.01}
            value={minPayment}
            onChange={(e) => setMinPayment(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
            Cancel
          </button>
        )}
        <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
