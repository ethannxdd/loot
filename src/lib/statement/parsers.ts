import type { ParsedTransaction } from '@/lib/types'

function parseAmount(raw: string): number {
  return Number(raw.replace(/[R,\s]/g, '')) || 0
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function fnbDateToIso(day: string, mon: string, year: string) {
  const m = MONTHS[mon.toLowerCase().slice(0, 3)] ?? '01'
  return `${year}-${m}-${day.padStart(2, '0')}`
}

/** Best-effort filter for FNB's internal own-account transfer noise (Business Rule 13 context). */
function isInternalFnbTransfer(description: string) {
  const d = description.toLowerCase()
  return (
    (d.includes('transfer') && (d.includes('own acc') || d.includes('savings pocket') || d.includes('notice pocket'))) ||
    d.includes('fnb app transfer between') ||
    d.includes('internal acb credit') && d.includes('own')
  )
}

/**
 * FNB PDF text pattern: "DD MMM YYYY  description  amount[Cr]  balance[Cr]"
 * Debits appear as a plain amount, credits carry a trailing "Cr".
 */
export function parseFnbText(text: string): ParsedTransaction[] {
  const lineRe =
    /^(\d{2})\s+([A-Za]{3})\s+(\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*(Cr)?\s+(-?[\d,]+\.\d{2})\s*(Cr)?$/i
  const out: ParsedTransaction[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const m = line.match(lineRe)
    if (!m) continue
    const [, day, mon, year, description, amountStr, credFlag, balanceStr] = m
    if (isInternalFnbTransfer(description)) continue

    const magnitude = Math.abs(parseAmount(amountStr))
    const isCredit = Boolean(credFlag) || amountStr.startsWith('-') === false && /deposit|salary|refund|credit/i.test(description)
    out.push({
      date: fnbDateToIso(day, mon, year),
      description: description.trim(),
      amount: credFlag ? magnitude : -magnitude,
      balance: parseAmount(balanceStr),
      category: null,
    })
    // amountStr sign already handled via credFlag; isCredit kept for future heuristics
    void isCredit
  }
  return out
}

/**
 * Capitec PDF text pattern: "YYYY-MM-DD  description  debit  credit  balance"
 * (debit/credit are separate columns — one is populated, the other blank or "-").
 */
export function parseCapitecText(text: string): ParsedTransaction[] {
  const lineRe =
    /^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-|[\d,]+\.\d{2})\s+(-|[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$/
  const out: ParsedTransaction[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const m = line.match(lineRe)
    if (!m) continue
    const [, date, description, debitStr, creditStr, balanceStr] = m
    const debit = debitStr === '-' ? 0 : parseAmount(debitStr)
    const credit = creditStr === '-' ? 0 : parseAmount(creditStr)
    if (debit === 0 && credit === 0) continue

    out.push({
      date,
      description: description.trim(),
      amount: credit > 0 ? credit : -debit,
      balance: parseAmount(balanceStr),
      category: null,
    })
  }
  return out
}

/** Generic CSV parser — detects Date/Description/Amount or Date/Description/Debit/Credit columns. */
export function parseCsv(text: string): ParsedTransaction[] {
  const rows = text
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
  if (rows.length < 2) return []

  const header = rows[0].map((h) => h.toLowerCase())
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)))

  const dateIdx = idx(['date'])
  const descIdx = idx(['description', 'narrative', 'details'])
  const amountIdx = idx(['amount'])
  const debitIdx = idx(['debit'])
  const creditIdx = idx(['credit'])
  const balanceIdx = idx(['balance'])
  if (dateIdx === -1 || descIdx === -1) return []

  const out: ParsedTransaction[] = []
  for (const row of rows.slice(1)) {
    if (row.length <= Math.max(dateIdx, descIdx)) continue
    const rawDate = row[dateIdx]
    const date = normalizeCsvDate(rawDate)
    if (!date) continue

    let amount = 0
    if (amountIdx !== -1) {
      amount = parseAmount(row[amountIdx] ?? '0')
    } else if (debitIdx !== -1 || creditIdx !== -1) {
      const debit = parseAmount(row[debitIdx] ?? '0')
      const credit = parseAmount(row[creditIdx] ?? '0')
      amount = credit > 0 ? credit : -Math.abs(debit)
    }
    if (amount === 0) continue

    out.push({
      date,
      description: (row[descIdx] ?? '').trim(),
      amount,
      balance: balanceIdx !== -1 ? parseAmount(row[balanceIdx] ?? '0') : null,
      category: null,
    })
  }
  return out
}

function normalizeCsvDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

/** Minimal OFX/QFX parser — extracts STMTTRN blocks via regex (OFX is often SGML, not strict XML). */
export function parseOfx(text: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = []
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? []

  for (const block of blocks) {
    const dateM = block.match(/<DTPOSTED>(\d{8})/i)
    const amtM = block.match(/<TRNAMT>(-?[\d.]+)/i)
    const nameM = block.match(/<NAME>([^\n<]+)/i)
    const memoM = block.match(/<MEMO>([^\n<]+)/i)
    if (!dateM || !amtM) continue

    const y = dateM[1].slice(0, 4)
    const mo = dateM[1].slice(4, 6)
    const d = dateM[1].slice(6, 8)
    out.push({
      date: `${y}-${mo}-${d}`,
      description: (nameM?.[1] ?? memoM?.[1] ?? 'Unknown').trim(),
      amount: Number(amtM[1]) || 0,
      balance: null,
      category: null,
    })
  }
  return out
}
