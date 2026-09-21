import type { ParsedTransaction } from '@/lib/types'

/*
 * Statement parsers. Every parser is pure text-in / transactions-out and runs in the browser only
 * (LOOT-FEATURES Business Rule 13). Amounts are signed: positive = money in, negative = money out.
 *
 * Bank statements differ in small ways (year omitted from the date, "Cr"/"Dr" suffixes, a fee column, one
 * amount column vs separate in/out columns), so the text parsers are deliberately forgiving rather than
 * matching one exact layout.
 */

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Parses a number written the way South African banks and spreadsheets write them: "1,234.56", "1 234.56",
 * "R 1 234,56", "(123.45)", "123.45-". Returns NaN when it isn't a number.
 */
export function parseLooseNumber(raw: string): number {
  let s = raw.trim().replace(/[R \s]/gi, '')
  if (!s) return NaN
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.endsWith('-')) {
    negative = true
    s = s.slice(0, -1)
  }
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: whichever comes last is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma !== -1) {
    // "1234,56" = decimal comma; "1,234" / "1,234,567" = thousands.
    s = /,\d{2}$/.test(s) && s.indexOf(',') === lastComma ? s.replace(',', '.') : s.replace(/,/g, '')
  }
  if (!/^\d*\.?\d+$/.test(s)) return NaN
  const value = Number(s)
  return negative ? -value : value
}

interface AmountToken {
  /** Absolute value. */
  value: number
  /** Sign written in the text: '-' / '(…)' → negative, 'Cr' → positive, 'Dr' → negative, otherwise null. */
  sign: 1 | -1 | null
  /** A trailing "K" marks FNB's accrued-fee column — not part of the transaction amount. */
  isFee: boolean
}

const AMOUNT_TOKEN = /^\(?-?R?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?-?(?:Cr|Dr|K)?$/i

function readAmountToken(token: string): AmountToken | null {
  if (!AMOUNT_TOKEN.test(token)) return null
  const suffix = token.match(/(Cr|Dr|K)$/i)?.[1]?.toLowerCase()
  const body = suffix ? token.slice(0, -suffix.length) : token
  const n = parseLooseNumber(body)
  if (!Number.isFinite(n)) return null
  let sign: 1 | -1 | null = null
  if (n < 0 || /^\(.*\)$/.test(body)) sign = -1
  else if (suffix === 'cr') sign = 1
  else if (suffix === 'dr') sign = -1
  return { value: Math.abs(n), sign, isFee: suffix === 'k' }
}

/** Splits a line into whitespace tokens, gluing a stray "Cr" / "Dr" / "K" onto the number before it. */
function tokenize(line: string): string[] {
  const raw = line.trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (const tok of raw) {
    if (/^(cr|dr|k)$/i.test(tok) && out.length > 0 && AMOUNT_TOKEN.test(out[out.length - 1])) {
      out[out.length - 1] += tok
    } else {
      out.push(tok)
    }
  }
  return out
}

/** Pops the run of amount tokens (and, when allowed, "-" placeholders) off the end of a token list. */
function popTrailingAmounts(tokens: string[], allowPlaceholder: boolean): { rest: string[]; cells: (AmountToken | null)[] } {
  const cells: (AmountToken | null)[] = []
  let end = tokens.length
  while (end > 0) {
    const tok = tokens[end - 1]
    if (allowPlaceholder && tok === '-' ) {
      cells.unshift(null)
      end--
      continue
    }
    const amount = readAmountToken(tok)
    if (!amount) break
    cells.unshift(amount)
    end--
  }
  return { rest: tokens.slice(0, end), cells }
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Reject impossible dates like 31 Feb rather than letting them roll into March.
  const d = new Date(year, month - 1, day)
  if (d.getMonth() !== month - 1) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Local-calendar 'YYYY-MM-DD' for a Date (never via toISOString, which shifts the day west/east of UTC). */
export function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The date range a statement covers, used to work out the year on lines that only print "15 Jan". */
export interface StatementPeriod {
  start: Date | null
  end: Date
}

/** Reads "Statement Period : 15 December 2025 to 14 January 2026" (or "Statement Date : …") from the page text. */
export function detectStatementPeriod(text: string): StatementPeriod | null {
  const range = text.match(
    /period[^\n]*?(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\s*(?:to|-|–|—)\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/i,
  )
  if (range) {
    const m1 = MONTHS[range[2].toLowerCase().slice(0, 3)]
    const m2 = MONTHS[range[5].toLowerCase().slice(0, 3)]
    if (m1 && m2) {
      return {
        start: new Date(Number(range[3]), m1 - 1, Number(range[1])),
        end: new Date(Number(range[6]), m2 - 1, Number(range[4])),
      }
    }
  }
  const single = text.match(/statement\s+date\s*:?\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/i)
  if (single) {
    const m = MONTHS[single[2].toLowerCase().slice(0, 3)]
    if (m) return { start: null, end: new Date(Number(single[3]), m - 1, Number(single[1])) }
  }
  return null
}

/** Picks the year for a "15 Jan" style date: the latest year that doesn't put it after the statement's end. */
function inferYear(month: number, day: number, period: StatementPeriod | null, now: Date): number {
  const end = period?.end ?? now
  const limit = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 31)
  let year = end.getFullYear()
  if (new Date(year, month - 1, day) > limit) year -= 1
  return year
}

interface LeadingDate {
  iso: string
  /** The line with the date removed. */
  rest: string
}

/** Reads a date at the start of a line: "15 Jan 2026", "15 Jan", "2026-01-15", "15/01/2026", "15/01/26". */
function readLeadingDate(line: string, period: StatementPeriod | null, now: Date): LeadingDate | null {
  let m = line.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b\s*/)
  if (m) {
    const iso = isoDate(Number(m[1]), Number(m[2]), Number(m[3]))
    return iso ? { iso, rest: line.slice(m[0].length) } : null
  }
  m = line.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b\s*/)
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    const iso = isoDate(year, Number(m[2]), Number(m[1])) // South African order: day first
    return iso ? { iso, rest: line.slice(m[0].length) } : null
  }
  m = line.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?(?:\s+(\d{4}))?\b\s*/)
  if (m) {
    const month = MONTHS[m[2].toLowerCase()]
    if (!month) return null
    const day = Number(m[1])
    const year = m[3] ? Number(m[3]) : inferYear(month, day, period, now)
    const iso = isoDate(year, month, day)
    return iso ? { iso, rest: line.slice(m[0].length) } : null
  }
  return null
}

const BALANCE_LINE = /\b(opening|closing|brought forward|carried forward|balance b\/f|balance c\/f)\b.*\bbalance\b|^\s*(opening|closing)\s+balance|balance\s+(brought|carried)\s+forward/i

// ---------------------------------------------------------------------------
// FNB
// ---------------------------------------------------------------------------

/**
 * FNB PDF text: "DD MMM [YYYY]  description  amount[Cr]  balance[Cr]  [fee K]". Debits are plain amounts,
 * credits carry "Cr". FNB statements normally leave the year off the line, so it is taken from the
 * "Statement Period" in the header.
 */
export function parseFnbText(text: string, now = new Date()): ParsedTransaction[] {
  const period = detectStatementPeriod(text)
  const out: ParsedTransaction[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || BALANCE_LINE.test(line)) continue
    const date = readLeadingDate(line, period, now)
    if (!date) continue

    const { rest, cells } = popTrailingAmounts(tokenize(date.rest), false)
    const numeric = cells.filter((c): c is AmountToken => c !== null && !c.isFee)
    if (numeric.length === 0 || rest.length === 0) continue
    // A lone "-" right before the amounts is a Capitec-style empty debit/credit column — not an FNB line.
    if (rest[rest.length - 1] === '-') continue

    const amountTok = numeric.length >= 2 ? numeric[numeric.length - 2] : numeric[0]
    const balanceTok = numeric.length >= 2 ? numeric[numeric.length - 1] : null
    if (amountTok.value === 0) continue

    out.push({
      date: date.iso,
      description: rest.join(' '),
      amount: amountTok.sign === 1 ? amountTok.value : -amountTok.value,
      balance: balanceTok ? (balanceTok.sign === -1 ? -balanceTok.value : balanceTok.value) : null,
      category: null,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Capitec
// ---------------------------------------------------------------------------

/**
 * Capitec PDF text: "date  description  debit  credit  balance" where the unused column shows "-" (or is
 * missing). When a line only carries one amount, the direction comes from a minus sign, or failing that
 * from whether the running balance went up or down.
 */
export function parseCapitecText(text: string, now = new Date()): ParsedTransaction[] {
  const period = detectStatementPeriod(text)
  const out: ParsedTransaction[] = []
  let previousBalance: number | null = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || BALANCE_LINE.test(line)) continue
    let date = readLeadingDate(line, period, now)
    if (!date) continue
    // Some layouts print a transaction date and a posting date side by side.
    const posting = readLeadingDate(date.rest, period, now)
    if (posting) date = { iso: date.iso, rest: posting.rest }

    const { rest, cells } = popTrailingAmounts(tokenize(date.rest), true)
    if (rest.length === 0 || cells.length < 2) continue

    const balanceCell = cells[cells.length - 1]
    if (!balanceCell) continue
    const balance = balanceCell.sign === -1 ? -balanceCell.value : balanceCell.value
    const moneyCells = cells.slice(0, -1)

    let amount = 0
    if (moneyCells.length >= 2) {
      const [debit, credit] = moneyCells.slice(-2)
      if (credit && credit.value > 0) amount = credit.value
      else if (debit && debit.value > 0) amount = -debit.value
    } else if (moneyCells[0]) {
      const cell = moneyCells[0]
      if (cell.sign !== null) amount = cell.sign * cell.value
      else if (previousBalance !== null) {
        const up = Math.abs(previousBalance + cell.value - balance)
        const down = Math.abs(previousBalance - cell.value - balance)
        amount = up < down ? cell.value : -cell.value
      } else {
        amount = -cell.value
      }
    }
    previousBalance = balance
    if (amount === 0) continue

    out.push({ date: date.iso, description: rest.join(' '), amount, balance, category: null })
  }
  return out
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 10)
  let best = ','
  let bestScore = 0
  for (const d of [',', ';', '\t']) {
    const score = sample.reduce((s, l) => s + (l.split(d).length - 1), 0)
    if (score > bestScore) {
      best = d
      bestScore = score
    }
  }
  return best
}

/** Splits one CSV line on `delimiter`, honouring "quoted, fields" and doubled quotes. */
export function splitCsvLine(line: string, delimiter = ','): string[] {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      cells.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  cells.push(cur.trim())
  return cells
}

/** Normalises a CSV/OFX date cell to 'YYYY-MM-DD' without ever passing through UTC. */
export function normalizeDateCell(raw: string, now = new Date()): string | null {
  const s = raw.trim()
  if (!s) return null
  const lead = readLeadingDate(s, null, now)
  if (lead) return lead.iso
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (compact) return isoDate(Number(compact[1]), Number(compact[2]), Number(compact[3]))
  // "Jan 15, 2026" / "January 15 2026"
  const us = s.match(/^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (us) {
    const month = MONTHS[us[1].toLowerCase()]
    return month ? isoDate(Number(us[3]), month, Number(us[2])) : null
  }
  return null
}

function findColumn(header: string[], matchers: RegExp[], exclude: number[] = []): number {
  for (const re of matchers) {
    const i = header.findIndex((h, idx) => !exclude.includes(idx) && re.test(h))
    if (i !== -1) return i
  }
  return -1
}

/** Generic CSV: Date + Description + (Amount | Debit/Credit | Money in/out) [+ Type] [+ Balance]. */
export function parseCsv(input: string): ParsedTransaction[] {
  const lines = input
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
  if (lines.length < 2) return []
  const delimiter = detectDelimiter(lines)
  const rows = lines.map((l) => splitCsvLine(l, delimiter))

  // Some exports put account details above the real header row.
  const headerIndex = rows.slice(0, 20).findIndex(
    (r) => r.some((c) => /date/i.test(c)) && r.some((c) => /desc|narr|detail|reference|payee|merchant|memo/i.test(c)),
  )
  if (headerIndex === -1) return []
  const header = rows[headerIndex].map((h) => h.toLowerCase())

  const dateIdx = findColumn(header, [/^(transaction |posting |value )?date$/, /date/])
  const descIdx = findColumn(header, [/^description$/, /desc|narrat|details?|payee|merchant|reference|memo/])
  const debitIdx = findColumn(header, [/^(debit|money out|withdrawal|paid out|out)\b/, /debit|money out|withdrawal|paid out/], [dateIdx, descIdx])
  const creditIdx = findColumn(header, [/^(credit|money in|deposit|paid in|in)\b/, /credit|money in|deposit|paid in/], [dateIdx, descIdx, debitIdx])
  const amountIdx = debitIdx === -1 && creditIdx === -1 ? findColumn(header, [/^amount$/, /amount|value/], [dateIdx, descIdx]) : -1
  const typeIdx = findColumn(header, [/^(type|dr\/cr|debit\/credit|transaction type)$/, /dr\/cr|debit\/credit|trans.*type/], [dateIdx, descIdx, amountIdx, debitIdx, creditIdx])
  const balanceIdx = findColumn(header, [/balance/], [dateIdx, descIdx, amountIdx, debitIdx, creditIdx])
  if (dateIdx === -1 || descIdx === -1) return []
  if (amountIdx === -1 && debitIdx === -1 && creditIdx === -1) return []

  const out: ParsedTransaction[] = []
  for (const row of rows.slice(headerIndex + 1)) {
    const date = normalizeDateCell(row[dateIdx] ?? '')
    if (!date) continue

    let amount = 0
    if (amountIdx !== -1) {
      const n = parseLooseNumber(row[amountIdx] ?? '')
      if (Number.isFinite(n)) {
        amount = n
        const type = (row[typeIdx] ?? '').toLowerCase()
        // A separate Type column means the amounts themselves are unsigned.
        if (typeIdx !== -1 && /^(debit|dr|withdrawal|out|payment)/.test(type)) amount = -Math.abs(n)
        else if (typeIdx !== -1 && /^(credit|cr|deposit|in|receipt)/.test(type)) amount = Math.abs(n)
      }
    } else {
      const debit = debitIdx !== -1 ? parseLooseNumber(row[debitIdx] ?? '') : NaN
      const credit = creditIdx !== -1 ? parseLooseNumber(row[creditIdx] ?? '') : NaN
      if (Number.isFinite(credit) && credit !== 0) amount = Math.abs(credit)
      else if (Number.isFinite(debit) && debit !== 0) amount = -Math.abs(debit)
    }
    if (amount === 0) continue

    const balance = balanceIdx !== -1 ? parseLooseNumber(row[balanceIdx] ?? '') : NaN
    out.push({
      date,
      description: (row[descIdx] ?? '').trim() || 'Unknown',
      amount: Math.round(amount * 100) / 100,
      balance: Number.isFinite(balance) ? balance : null,
      category: null,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// OFX / QFX
// ---------------------------------------------------------------------------

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
}

/** Minimal OFX/QFX parser — extracts STMTTRN blocks via regex (OFX is often SGML, not strict XML). */
export function parseOfx(text: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = []
  const blocks =
    text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? []

  for (const block of blocks) {
    const dateM = block.match(/<DTPOSTED>\s*(\d{8})/i)
    const amtM = block.match(/<TRNAMT>\s*([^\s<]+)/i)
    const nameM = block.match(/<NAME>\s*([^\r\n<]+)/i)
    const memoM = block.match(/<MEMO>\s*([^\r\n<]+)/i)
    if (!dateM || !amtM) continue

    const date = normalizeDateCell(dateM[1])
    const amount = parseLooseNumber(amtM[1])
    if (!date || !Number.isFinite(amount) || amount === 0) continue

    const name = nameM?.[1]?.trim()
    const memo = memoM?.[1]?.trim()
    // Some banks put a generic word in NAME and the merchant in MEMO.
    const description = name && !/^(debit|credit|pos|purchase|payment|deposit)$/i.test(name) ? name : memo || name || 'Unknown'
    out.push({ date, description: decodeEntities(description), amount, balance: null, category: null })
  }
  return out
}
