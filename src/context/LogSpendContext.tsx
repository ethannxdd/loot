import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface LogSpendPrefill {
  amount?: number
  merchant?: string
  category?: string
}

interface LogSpendContextValue {
  open: boolean
  prefill: LogSpendPrefill | null
  openLog: (prefill?: LogSpendPrefill) => void
  closeLog: () => void
}

const LogSpendContext = createContext<LogSpendContextValue | null>(null)

/** Lets any page (top bar, hero, /spending, `?log=1`) open the one Log sheet mounted in the app shell. */
export function LogSpendProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState<LogSpendPrefill | null>(null)
  const openLog = useCallback((p?: LogSpendPrefill) => {
    setPrefill(p ?? null)
    setOpen(true)
  }, [])
  const closeLog = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ open, prefill, openLog, closeLog }), [open, prefill, openLog, closeLog])
  return <LogSpendContext.Provider value={value}>{children}</LogSpendContext.Provider>
}

export function useLogSpendSheet() {
  const ctx = useContext(LogSpendContext)
  if (!ctx) throw new Error('useLogSpendSheet must be used within a LogSpendProvider')
  return ctx
}
