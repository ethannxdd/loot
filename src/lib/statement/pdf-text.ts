/**
 * Extracts raw text from a PDF, entirely client-side (pdfjs-dist).
 * No transaction data ever leaves the browser — see LOOT-FEATURES.md Business Rule 13.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const lines: string[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    // Group text items by their y-position so a "line" on the PDF page
    // becomes one line of text, preserving left-to-right reading order.
    const rows = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5])
      const x = item.transform[4]
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ x, str: item.str })
    }
    const sortedY = [...rows.keys()].sort((a, b) => b - a)
    for (const y of sortedY) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x)
      lines.push(row.map((r) => r.str).join(' ').replace(/\s+/g, ' ').trim())
    }
  }
  return lines.filter(Boolean).join('\n')
}
