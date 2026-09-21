import { extractPdfText } from './pdf-text'
import { parseCapitecText, parseCsv, parseFnbText, parseOfx } from './parsers'
import type { BankId, ParsedTransaction } from '@/lib/types'

export * from './analyze'
export * from './categorize'
export { PdfPasswordError } from './pdf-text'

export interface ParseOutcome {
  transactions: ParsedTransaction[]
  /** Transfers between the user's own accounts, left out so they don't count as income or spending. */
  skippedTransfers: number
  /** Set when the file matched the other bank's layout rather than the one selected. */
  detectedBank: BankId | null
  /** True when the file had no readable text at all (a scanned/image PDF). */
  noText: boolean
}

/** Best-effort filter for transfers between a user's own accounts (Business Rule 13 context). */
export function isInternalTransfer(description: string): boolean {
  const d = description.toLowerCase()
  return (
    /\b(own acc(ount)?s?|between (my )?accounts?|savings pocket|notice pocket|pocket transfer|internal transfer|inter-?account)\b/.test(d) ||
    (/\btransfer\b/.test(d) && /\b(to|from)\s+(my\s+)?(savings|notice|call|money market)\b/.test(d)) ||
    (d.includes('internal acb credit') && d.includes('own'))
  )
}

export function dropInternalTransfers(transactions: ParsedTransaction[]) {
  const kept = transactions.filter((t) => !isInternalTransfer(t.description))
  return { kept, skipped: transactions.length - kept.length }
}

/** Reads the bank named in a statement's header (first lines only), or null when it is unclear. */
export function sniffBank(text: string): BankId | null {
  const header = text.split('\n').slice(0, 15).join('\n')
  const capitec = /capitec/i.test(header)
  const fnb = /\bfnb\b|first national bank/i.test(header)
  if (capitec === fnb) return null
  return capitec ? 'capitec' : 'fnb'
}

/**
 * Parses statement text with the right bank's layout. The bank named in the statement header wins over the
 * one selected in the UI; if the first layout finds nothing, the other is tried. `detectedBank` is set
 * whenever the layout used isn't the one the user picked.
 */
export function parseStatementText(text: string, bank: BankId): { transactions: ParsedTransaction[]; detectedBank: BankId | null } {
  const parsers: Record<BankId, (t: string) => ParsedTransaction[]> = { fnb: parseFnbText, capitec: parseCapitecText }
  const first: BankId = sniffBank(text) ?? bank
  const second: BankId = first === 'fnb' ? 'capitec' : 'fnb'
  for (const candidate of [first, second]) {
    const transactions = parsers[candidate](text)
    if (transactions.length > 0) return { transactions, detectedBank: candidate === bank ? null : candidate }
  }
  return { transactions: [], detectedBank: null }
}

export async function parseStatementFile(file: File, bank: BankId, password?: string): Promise<ParseOutcome> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  let raw: ParsedTransaction[] = []
  let detectedBank: BankId | null = null
  let noText = false

  if (ext === 'pdf') {
    const text = await extractPdfText(file, password)
    noText = text.trim().length < 20
    const result = parseStatementText(text, bank)
    raw = result.transactions
    detectedBank = result.detectedBank
  } else {
    const text = await file.text()
    if (ext === 'ofx' || ext === 'qfx') {
      raw = parseOfx(text)
    } else {
      // csv, or an unknown text-like extension — try generic CSV first
      raw = parseCsv(text)
      if (raw.length === 0) {
        // Some banks export ".csv" that is really a plain-text statement dump.
        const result = parseStatementText(text, bank)
        raw = result.transactions
        detectedBank = result.detectedBank
      }
    }
  }

  const { kept, skipped } = dropInternalTransfers(raw)
  return { transactions: kept, skippedTransfers: skipped, detectedBank, noText }
}
