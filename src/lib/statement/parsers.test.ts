import { describe, expect, it } from 'vitest'
import {
  detectStatementPeriod,
  normalizeDateCell,
  parseCapitecText,
  parseCsv,
  parseFnbText,
  parseLooseNumber,
  parseOfx,
  splitCsvLine,
} from './parsers'
import { dropInternalTransfers, isInternalTransfer, parseStatementText, sniffBank } from './index'

const now = new Date(2026, 8, 21)

describe('parseLooseNumber', () => {
  it.each([
    ['1,234.56', 1234.56],
    ['1 234.56', 1234.56],
    ['R 1 234,56', 1234.56],
    ['1234,56', 1234.56],
    ['(123.45)', -123.45],
    ['123.45-', -123.45],
    ['-50', -50],
    ['+50.5', 50.5],
    ['1,234,567.89', 1234567.89],
    ['1,234', 1234],
    ['R0.00', 0],
  ])('%s → %d', (input, expected) => {
    expect(parseLooseNumber(input)).toBeCloseTo(expected)
  })

  it.each(['', 'abc', '12.34.56', 'R'])('%j is not a number', (input) => {
    expect(parseLooseNumber(input)).toBeNaN()
  })
})

describe('detectStatementPeriod', () => {
  it('reads a period range', () => {
    const p = detectStatementPeriod('Statement Period : 15 December 2025 to 14 January 2026')!
    expect(p.start).toEqual(new Date(2025, 11, 15))
    expect(p.end).toEqual(new Date(2026, 0, 14))
  })

  it('reads a single statement date', () => {
    const p = detectStatementPeriod('Statement Date : 28 Feb 2026')!
    expect(p.start).toBeNull()
    expect(p.end).toEqual(new Date(2026, 1, 28))
  })

  it('returns null when there is nothing to read', () => {
    expect(detectStatementPeriod('nothing here')).toBeNull()
  })
})

describe('normalizeDateCell', () => {
  it.each([
    ['2026-01-15', '2026-01-15'],
    ['15/01/2026', '2026-01-15'],
    ['15-01-26', '2026-01-15'],
    ['15 Jan 2026', '2026-01-15'],
    ['20260115', '2026-01-15'],
    ['20260115120000[+2:SAST]', '2026-01-15'],
    ['Jan 15, 2026', '2026-01-15'],
    ['2026/1/5', '2026-01-05'],
  ])('%s', (input, expected) => {
    expect(normalizeDateCell(input)).toBe(expected)
  })

  it('rejects impossible dates instead of rolling them over', () => {
    expect(normalizeDateCell('31/02/2026')).toBeNull()
    expect(normalizeDateCell('not a date')).toBeNull()
    expect(normalizeDateCell('')).toBeNull()
  })
})

describe('parseFnbText', () => {
  const statement = `
FNB Statement
Statement Period : 15 December 2025 to 14 January 2026
Opening Balance 12,000.00Cr
17 Dec POS PURCHASE WOOLWORTHS 4821 250.50 11,749.50Cr
19 Dec SALARY ACME PTY LTD 30,000.00Cr 41,749.50Cr
02 Jan DEBIT ORDER NETFLIX 199.00 41,550.50Cr 2.50K
05 Jan MONTHLY ACCOUNT FEE 69.00 41,481.50Cr
14 Jan INSURANCE PREMIUM 1,200.00 40,281.50Cr
Closing Balance 40,281.50Cr
`

  it('takes the year from the statement period, including the December → January rollover', () => {
    const tx = parseFnbText(statement, now)
    expect(tx.map((t) => t.date)).toEqual(['2025-12-17', '2025-12-19', '2026-01-02', '2026-01-05', '2026-01-14'])
  })

  it('reads amounts with Cr as credits and plain amounts as debits; ignores the fee column', () => {
    const tx = parseFnbText(statement, now)
    expect(tx.map((t) => t.amount)).toEqual([-250.5, 30000, -199, -69, -1200])
    expect(tx[2].description).toBe('DEBIT ORDER NETFLIX')
    expect(tx[0].balance).toBe(11749.5)
  })

  it('skips opening and closing balance lines', () => {
    const tx = parseFnbText(statement, now)
    expect(tx.some((t) => /balance/i.test(t.description))).toBe(false)
  })

  it('accepts lines that carry a full year', () => {
    const tx = parseFnbText('15 Mar 2025 SHOP 10.00 90.00Cr', now)
    expect(tx).toHaveLength(1)
    expect(tx[0].date).toBe('2025-03-15')
  })

  it('parses every month name (regression: a bad character class dropped some months)', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    for (const m of months) {
      const tx = parseFnbText(`Statement Date : 31 Dec 2026\n10 ${m} SHOP ${m} 10.00 90.00Cr`, now)
      expect(tx, m).toHaveLength(1)
    }
  })

  it('ignores lines without an amount and text without dates', () => {
    expect(parseFnbText('Hello world\n17 Dec just words here', now)).toEqual([])
  })

  it('handles Cr glued or spaced, and thousands separators with spaces', () => {
    const tx = parseFnbText('Statement Date : 31 Jan 2026\n05 Jan REFUND 1,500.00 Cr 9,000.00 Cr', now)
    expect(tx[0].amount).toBe(1500)
  })
})

describe('parseCapitecText', () => {
  const statement = `
Statement Period: 01 Jan 2026 - 31 Jan 2026
01/01/2026 Opening Balance 1,000.00
03/01/2026 Groceries CHECKERS SANDTON 350.00 - 650.00
15/01/2026 Salary ACME - 25,000.00 25,650.00
20/01/2026 Payment Uber Trip 89.90 - 25,560.10
`

  it('reads the debit and credit columns using "-" as the empty placeholder', () => {
    const tx = parseCapitecText(statement, now)
    expect(tx.map((t) => t.amount)).toEqual([-350, 25000, -89.9])
    expect(tx.map((t) => t.date)).toEqual(['2026-01-03', '2026-01-15', '2026-01-20'])
    expect(tx[0].description).toBe('Groceries CHECKERS SANDTON')
  })

  it('infers direction from the running balance when only one amount is printed', () => {
    const tx = parseCapitecText('05/02/2026 First 100.00 900.00\n06/02/2026 Refund 50.00 950.00\n07/02/2026 Shop 30.00 920.00', now)
    // first line has no previous balance → treated as a debit; then +50 and −30
    expect(tx.map((t) => t.amount)).toEqual([-100, 50, -30])
  })

  it('skips a duplicated posting date', () => {
    const tx = parseCapitecText('03/01/2026 04/01/2026 Coffee 40.00 - 960.00', now)
    expect(tx[0].description).toBe('Coffee')
  })
})

describe('CSV', () => {
  it('splitCsvLine honours quotes and doubled quotes', () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
    expect(splitCsvLine('"he said ""hi""",x')).toEqual(['he said "hi"', 'x'])
    expect(splitCsvLine('a;b;c', ';')).toEqual(['a', 'b', 'c'])
  })

  it('amount column with signed values and a quoted description containing a comma', () => {
    const csv = 'Date,Description,Amount,Balance\n2026-01-03,"Pick n Pay, Sandton",-350.50,649.50\n2026-01-15,Salary,25000,25649.50'
    const tx = parseCsv(csv)
    expect(tx).toHaveLength(2)
    expect(tx[0]).toMatchObject({ date: '2026-01-03', description: 'Pick n Pay, Sandton', amount: -350.5, balance: 649.5 })
    expect(tx[1].amount).toBe(25000)
  })

  it('debit / credit columns', () => {
    const csv = 'Date,Narrative,Debit,Credit\n03/01/2026,SHOP,120.00,\n04/01/2026,PAY,,5000.00'
    expect(parseCsv(csv).map((t) => t.amount)).toEqual([-120, 5000])
  })

  it('semicolon delimiter with decimal commas', () => {
    const csv = 'Date;Description;Amount\n03/01/2026;Shop;-1 234,50'
    expect(parseCsv(csv)[0].amount).toBe(-1234.5)
  })

  it('a Type column makes unsigned amounts debits or credits', () => {
    const csv = 'Date,Description,Amount,Type\n2026-01-03,Shop,50.00,Debit\n2026-01-04,Pay,900.00,Credit'
    expect(parseCsv(csv).map((t) => t.amount)).toEqual([-50, 900])
  })

  it('skips account details above the header row, a BOM and blank lines', () => {
    const csv = '﻿Account: 123\nName: Someone\n\nDate,Description,Amount\n2026-01-03,Shop,-10'
    expect(parseCsv(csv)).toHaveLength(1)
  })

  it('returns [] for files it cannot understand', () => {
    expect(parseCsv('just one line')).toEqual([])
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([])
    expect(parseCsv('Date,Description\n2026-01-01,Shop')).toEqual([])
  })

  it('drops rows with a bad date or zero amount', () => {
    const csv = 'Date,Description,Amount\nnot-a-date,X,-5\n2026-01-01,Zero,0\n2026-01-02,Ok,-5'
    expect(parseCsv(csv)).toHaveLength(1)
  })
})

describe('OFX', () => {
  it('parses XML-style blocks and prefers MEMO when NAME is a generic word', () => {
    const ofx = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260103120000<TRNAMT>-150.00<NAME>POS<MEMO>WOOLWORTHS &amp; CO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260115<TRNAMT>25000.00<NAME>ACME SALARY</STMTTRN>
</BANKTRANLIST></OFX>`
    const tx = parseOfx(ofx)
    expect(tx).toEqual([
      { date: '2026-01-03', description: 'WOOLWORTHS & CO', amount: -150, balance: null, category: null },
      { date: '2026-01-15', description: 'ACME SALARY', amount: 25000, balance: null, category: null },
    ])
  })

  it('parses SGML-style OFX with no closing tags', () => {
    const ofx = `<STMTTRN>\n<DTPOSTED>20260103\n<TRNAMT>-42.10\n<NAME>SHOP\n<STMTTRN>\n<DTPOSTED>20260104\n<TRNAMT>10.00\n<NAME>REFUND\n</BANKTRANLIST>`
    expect(parseOfx(ofx).map((t) => t.amount)).toEqual([-42.1, 10])
  })
})

describe('internal transfers and bank fallback', () => {
  it('recognises transfers between the user\'s own accounts', () => {
    expect(isInternalTransfer('Transfer to savings pocket')).toBe(true)
    expect(isInternalTransfer('TRANSFER FROM MY SAVINGS')).toBe(true)
    expect(isInternalTransfer('Payment to own account')).toBe(true)
    expect(isInternalTransfer('POS PURCHASE WOOLWORTHS')).toBe(false)
    expect(isInternalTransfer('Transfer to John Smith')).toBe(false)
  })

  it('dropInternalTransfers reports how many were removed', () => {
    const tx = [
      { date: '2026-01-01', description: 'Savings pocket transfer', amount: -500, balance: null, category: null },
      { date: '2026-01-02', description: 'Shop', amount: -50, balance: null, category: null },
    ]
    const { kept, skipped } = dropInternalTransfers(tx)
    expect(kept).toHaveLength(1)
    expect(skipped).toBe(1)
  })

  it('falls back to the other bank layout when the chosen one finds nothing', () => {
    const capitecStyle = '03/01/2026 CHECKERS 350.00 - 650.00\n04/01/2026 SALARY - 1,000.00 1,650.00'
    const res = parseStatementText(capitecStyle, 'fnb')
    expect(res.transactions.length).toBeGreaterThan(0)
    expect(res.detectedBank).toBe('capitec')
    expect(parseStatementText(capitecStyle, 'capitec').detectedBank).toBeNull()
  })
})

describe('bank sniffing', () => {
  const fnbText = 'FNB\nStatement Period : 15 December 2025 to 14 January 2026\n17 Dec SHOP 250.50 11,749.50Cr'

  it('uses the bank named in the header even if the wrong one was selected', () => {
    const res = parseStatementText(fnbText, 'capitec')
    expect(res.detectedBank).toBe('fnb')
    expect(res.transactions[0].amount).toBe(-250.5)
  })

  it('ignores bank names that appear only deeper in the statement', () => {
    const lines = ['Account statement', ...Array(20).fill('filler line'), '17 Dec PAYMENT TO CAPITEC 10.00 90.00Cr']
    expect(sniffBank(lines.join('\n'))).toBeNull()
  })

  it('unclear headers fall back to the selected bank', () => {
    expect(sniffBank('FNB and Capitec both named')).toBeNull()
    expect(sniffBank('')).toBeNull()
  })
})
