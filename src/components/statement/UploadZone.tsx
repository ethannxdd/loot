import { FileUp, Loader2, UploadCloud } from 'lucide-react'
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
    <div className="card space-y-4">
      <div>
        <p className="field-label">Bank</p>
        <div className="flex gap-2">
          {(['fnb', 'capitec'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onBankChange(b)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                bank === b
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-border bg-surface-2 text-muted-foreground'
              }`}
            >
              {b === 'fnb' ? 'FNB' : 'Capitec'}
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-primary/30'
        }`}
      >
        {isProcessing ? (
          <Loader2 size={28} strokeWidth={1.75} className="animate-spin text-primary" />
        ) : (
          <UploadCloud size={28} strokeWidth={1.75} className="text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-semibold">
            {isProcessing ? 'Reading your statement…' : 'Drag a statement here, or click to browse'}
          </p>
          <p className="mt-1 text-xs text-text-muted">PDF, CSV, OFX or QFX — parsed entirely on your device</p>
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
        <div className="flex items-center gap-2 rounded-lg border border-alert/30 bg-alert/10 px-3 py-2.5 text-xs text-alert">
          <FileUp size={14} strokeWidth={1.75} />
          {error}
        </div>
      )}

      <p className="text-xs text-text-subtle">
        Your statement is parsed in your browser and never uploaded anywhere. Only if you press “Save this analysis”
        are the category totals (and the names of any subscriptions found) saved to your Loot account — never the
        transactions themselves.
      </p>
    </div>
  )
}
