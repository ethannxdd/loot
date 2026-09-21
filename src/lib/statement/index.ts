import { extractPdfText } from './pdf-text'
import { parseCapitecText, parseCsv, parseFnbText, parseOfx } from './parsers'
import type { BankId, ParsedTransaction } from '@/lib/types'

export * from './analyze'
export * from './categorize'

export async function parseStatementFile(file: File, bank: BankId): Promise<ParsedTransaction[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf') {
    const text = await extractPdfText(file)
    return bank === 'fnb' ? parseFnbText(text) : parseCapitecText(text)
  }

  const text = await file.text()

  if (ext === 'ofx' || ext === 'qfx') {
    return parseOfx(text)
  }

  // csv, or unknown text-like extension — try generic CSV first
  const csvResult = parseCsv(text)
  if (csvResult.length > 0) return csvResult

  // fall back to bank-specific text parsing (some banks export ".csv" that's really
  // a plain-text statement dump)
  return bank === 'fnb' ? parseFnbText(text) : parseCapitecText(text)
}
