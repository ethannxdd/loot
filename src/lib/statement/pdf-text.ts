/** Thrown when a PDF needs a password (or the one supplied was wrong). */
export class PdfPasswordError extends Error {
  readonly wrongPassword: boolean
  constructor(wrongPassword: boolean) {
    super(wrongPassword ? 'That password did not unlock the PDF.' : 'This PDF is password protected.')
    this.name = 'PdfPasswordError'
    this.wrongPassword = wrongPassword
  }
}

interface TextItem {
  x: number
  y: number
  str: string
}

/** Groups text fragments into visual lines: items whose baselines are within a few points share a line. */
export function itemsToLines(items: TextItem[], tolerance = 3): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: { y: number; items: TextItem[] }[] = []
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= tolerance)
    if (row) row.items.push(item)
    else rows.push({ y: item.y, items: [item] })
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
}

/**
 * Extracts raw text from a PDF, entirely client-side (pdfjs-dist).
 * No transaction data ever leaves the browser — see LOOT-FEATURES.md Business Rule 13.
 */
export async function extractPdfText(file: File, password?: string): Promise<string> {
  // The "legacy" build carries polyfills (e.g. Math.sumPrecise) that current pdf.js needs but iOS WebViews and
  // slightly older Chrome/Safari lack — the modern build fails on real bank PDFs with embedded fonts there.
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  const buffer = await file.arrayBuffer()
  let pdf
  try {
    pdf = await pdfjsLib.getDocument({ data: buffer, password }).promise
  } catch (err) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'PasswordException') {
      throw new PdfPasswordError(Boolean(password))
    }
    console.warn('[loot] could not open PDF', (err as { name?: string })?.name, (err as { message?: string })?.message)
    throw new Error("Couldn't open that PDF. It may be damaged, or not a bank statement PDF.")
  }

  const lines: string[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const items: TextItem[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      items.push({ x: item.transform[4], y: item.transform[5], str: item.str })
    }
    lines.push(...itemsToLines(items))
  }
  return lines.join('\n')
}
