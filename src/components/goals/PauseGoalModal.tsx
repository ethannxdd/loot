import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { SavingsGoal } from '@/lib/types'

interface PauseGoalModalProps {
  goal: SavingsGoal
  isPending?: boolean
  onConfirm: (resumeDate: string | null) => void
  onCancel: () => void
}

/** Pausing a goal takes it out of the monthly commitment. An optional date brings it back automatically. */
export function PauseGoalModal({ goal, isPending = false, onConfirm, onCancel }: PauseGoalModalProps) {
  const [resume, setResume] = useState('')
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const min = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  function submit(e: FormEvent) {
    e.preventDefault()
    onConfirm(resume || null)
  }

  return (
    <Modal title={`Pause ${goal.name}?`} onClose={onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A paused goal drops out of your monthly commitment and auto-funding. Your progress stays exactly as it is.
        </p>
        <div>
          <label className="field-label" htmlFor="pause-resume">
            Resume on (optional)
          </label>
          <input id="pause-resume" type="date" min={min} value={resume} onChange={(e) => setResume(e.target.value)} />
          <p className="mt-1.5 text-xs text-text-muted">Leave blank to resume it yourself whenever you're ready.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button type="submit" disabled={isPending} className="btn btn-primary flex-1">
            {isPending && <Loader2 size={16} className="animate-spin" />}
            Pause goal
          </button>
        </div>
      </form>
    </Modal>
  )
}
