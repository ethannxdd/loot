import { FileUp, Loader2, UploadCloud, Lock } from 'lucide-react'
import { Segmented } from '@/components/ui/Segmented'
import { useRef, useState, type DragEvent } from 'react'
import type { BankId } from '@/lib/types'

interface UploadZoneProps {
  bank: BankId
  onBankChange: (bank: BankId) => void
  onFile: (file: File) => void
  isProcessing: boolean
  error: string | null
}

export function UploadZone({ bank, onBankChange, onFile, isProcessing, error }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div className="card-elevated space-y-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="card-title">Upload a statement</h2>
        <Segmented
          label="Bank"
          value={bank}
          onChange={onBankChange}
          options={[
            { value: 'fnb', label: 'FNB' },
            { value: 'capitec', label: 'Capitec' },
          ]}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label="Choose a statement file"
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/[0.06]' : 'border-border bg-surface-2 hover:border-primary/40'
        }`}
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary">
          {isProcessing ? (
            <Loader2 size={26} strokeWidth={2} className="animate-spin" />
          ) : (
            <UploadCloud size={26} strokeWidth={2} />
          )}
        </span>
        <div>
          <p className="text-[16px] font-semibold">
            {isProcessing ? 'Reading your statement…' : 'Drop a statement here, or choose a file'}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">PDF, CSV, OFX or QFX</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,.ofx,.qfx,text/csv,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-alert/10 px-3.5 py-3 text-[13px] font-medium text-alert">
          <FileUp size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <p className="flex gap-2 text-[12.5px] text-muted-foreground">
        <Lock size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-primary" />
        <span>
        Your statement is parsed in your browser and never uploaded anywhere. Only if you press “Save this analysis”
        are the category totals (and the names of any subscriptions found) saved to your Loot account — never the
        transactions themselves.
        </span>
      </p>
    </div>
  )
}
