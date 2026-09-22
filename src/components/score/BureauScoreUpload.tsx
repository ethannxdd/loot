import { Loader2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Select } from '@/components/ui/Select'
import { useAddBureauScore, useDeleteBureauScore } from '@/hooks/useBureauScores'
import type { BureauScore, ScoreFactors } from '@/lib/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const BUREAUS = ['TransUnion', 'Experian', 'Compuscan', 'XDS'] as const

interface BureauScoreUploadProps {
  scores: BureauScore[]
  estimatedScore: number | null
  factors: ScoreFactors | null
}

export function BureauScoreUpload({ scores, estimatedScore, factors }: BureauScoreUploadProps) {
  const addScore = useAddBureauScore()
  const deleteScore = useDeleteBureauScore()
  const [bureau, setBureau] = useState<string>(BUREAUS[0])
  const [score, setScore] = useState('')
  const [reportedOn, setReportedOn] = useState(() => new Date().toISOString().slice(0, 10))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = Number(score)
    if (!parsed || parsed < 0) return
    addScore.mutate(
      { input: { bureau, score: parsed, reported_on: reportedOn }, estimatedScore, factors },
      { onSuccess: () => setScore('') }
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="overline-label mb-1">Bureau score</p>
        <p className="text-xs text-muted-foreground">
          Add a real credit bureau score to see how close the Loot estimate gets — every upload helps tune the
          calculation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2.5">
        <div className="min-w-[110px] flex-1">
          <label className="field-label" htmlFor="bureau-select">
            Bureau
          </label>
          <Select id="bureau-select" value={bureau} onValueChange={setBureau} options={BUREAUS.map((b) => ({ value: b, label: b }))} />
        </div>
        <div className="w-24">
          <label className="field-label" htmlFor="bureau-score">
            Score
          </label>
          <input id="bureau-score" type="number" min={0} max={999} value={score} onChange={(e) => setScore(e.target.value)} placeholder="650" required />
        </div>
        <div className="w-36">
          <label className="field-label" htmlFor="bureau-date">
            Reported on
          </label>
          <input id="bureau-date" type="date" value={reportedOn} onChange={(e) => setReportedOn(e.target.value)} required />
        </div>
        <button type="submit" disabled={addScore.isPending} className="btn btn-secondary h-[42px]">
          {addScore.isPending && <Loader2 size={15} className="animate-spin" />}
          Add
        </button>
      </form>

      {scores.length > 0 && (
        <div className="space-y-1.5">
          {[...scores]
            .reverse()
            .map((s) => (
              <div key={s.id} className="group flex items-center justify-between rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm">
                <div>
                  <span className="font-semibold">{s.bureau}</span>
                  <span className="ml-2 text-xs text-text-muted">{formatDate(s.reported_on)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tnum font-semibold">{s.score}</span>
                  {s.gap !== null && (
                    <span className={`text-xs ${Math.abs(s.gap) <= 30 ? 'text-primary' : 'text-caution'}`}>
                      {s.gap >= 0 ? '+' : ''}
                      {Math.round(s.gap)} vs estimate
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteScore.mutate(s.id)}
                    aria-label="Delete"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted opacity-0 hover:bg-white/10 hover:text-alert group-hover:opacity-100"
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
