import { Loader2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Select } from '@/components/ui/Select'
import { toast } from 'sonner'
import { useAddBureauScore, useDeleteBureauScore } from '@/hooks/useBureauScores'
import { BUREAU_OPTIONS, bureauScaleMax, defaultScaleMax } from '@/lib/loot-score'
import type { BureauScore, ScoreFactors } from '@/lib/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface BureauScoreUploadProps {
  scores: BureauScore[]
  /** Current internal habits index (0–999) — stored with the score so later estimates can drift from it. */
  currentIndex: number | null
  factors: ScoreFactors | null
}

export function BureauScoreUpload({ scores, currentIndex, factors }: BureauScoreUploadProps) {
  const addScore = useAddBureauScore()
  const deleteScore = useDeleteBureauScore()
  const [bureau, setBureau] = useState<string>(BUREAU_OPTIONS[0].value)
  const [scaleMax, setScaleMax] = useState(String(BUREAU_OPTIONS[0].defaultMax))
  const [score, setScore] = useState('')
  const [reportedOn, setReportedOn] = useState(() => new Date().toISOString().slice(0, 10))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = Number(score)
    const max = Number(scaleMax)
    if (!(max > 0)) return toast.error('Enter the top of the scale your score is out of.')
    if (!(parsed > 0) || parsed > max) return toast.error(`Enter a score between 1 and ${max}.`)
    addScore.mutate(
      { input: { bureau, score: parsed, reported_on: reportedOn }, scaleMax: max, currentIndex, factors },
      {
        onSuccess: () => {
          setScore('')
          toast.success('Score saved — your Loot Score now uses it')
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-0.5 text-[15px] font-semibold">Your real credit score</h3>
        <p className="text-[13px] text-muted-foreground">
          Add the score from ClearScore, TransUnion or your bank app. Loot anchors its estimate to your latest one, so
          add a new score whenever yours changes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2.5">
        <div className="min-w-[110px] flex-1">
          <label className="field-label" htmlFor="bureau-select">
            Bureau
          </label>
          <Select
            id="bureau-select"
            value={bureau}
            onValueChange={(v) => {
              setBureau(v)
              setScaleMax(String(defaultScaleMax(v)))
            }}
            options={BUREAU_OPTIONS.map((b) => ({ value: b.value, label: b.label }))}
          />
        </div>
        <div className="w-24">
          <label className="field-label" htmlFor="bureau-score">
            Score
          </label>
          <input id="bureau-score" type="number" inputMode="numeric" min={1} max={Number(scaleMax) || 999} value={score} onChange={(e) => setScore(e.target.value)} placeholder="650" required />
        </div>
        <div className="w-24">
          <label className="field-label" htmlFor="bureau-max">
            Out of
          </label>
          <input id="bureau-max" type="number" inputMode="numeric" min={100} value={scaleMax} onChange={(e) => setScaleMax(e.target.value)} />
        </div>
        <div className="w-36">
          <label className="field-label" htmlFor="bureau-date">
            Reported on
          </label>
          <input id="bureau-date" type="date" value={reportedOn} onChange={(e) => setReportedOn(e.target.value)} required />
        </div>
        <button type="submit" disabled={addScore.isPending} className="btn btn-secondary">
          {addScore.isPending && <Loader2 size={15} className="animate-spin" />}
          Add
        </button>
      </form>

      {scores.length > 0 && (
        <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-fill">
          {[...scores]
            .reverse()
            .map((s) => (
              <div key={s.id} className="group flex items-center justify-between px-3.5 py-3 text-[15px]">
                <div>
                  <span className="font-semibold">{s.bureau}</span>
                  <span className="ml-2 text-[13px] text-muted-foreground">{formatDate(s.reported_on)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tnum font-semibold">
                    {s.score}
                    <span className="font-normal text-text-subtle"> /{bureauScaleMax(s)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteScore.mutate(s.id)}
                    aria-label="Delete"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-fill-2 hover:text-alert md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
