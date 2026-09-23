/** Shared PNG/PDF export helpers for the Planner, Compare and Monthly close. */
import type { ReactNode } from 'react'
import { toast } from 'sonner'

/** Exports sit on the current theme's page background, so they match what the user sees. */
function background() {
  const bg = getComputedStyle(document.body).backgroundColor
  return bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#f2f2ef'
}

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'loot-export'
}

async function render(el: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas')
  // Anything marked data-export-ignore (action buttons) is left out of the picture.
  return html2canvas(el, {
    backgroundColor: background(),
    scale: 2,
    ignoreElements: (node) => node instanceof HTMLElement && node.hasAttribute('data-export-ignore'),
    // html2canvas draws text glyph-by-glyph when letter-spacing is set, which splits tabular figures
    // ("R 11,1 40"). Exports render from a clone with tracking reset — the on-screen page is untouched.
    onclone: (doc) => doc.documentElement.classList.add('export-snapshot'),
  })
}

function failed(err: unknown) {
  console.error('Export failed', err)
  toast.error("Couldn't create that export. Try again, or take a screenshot instead.")
}

export async function exportElementAsPng(el: HTMLElement, filename: string) {
  try {
    const canvas = await render(el)
    const name = safeName(filename)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = name.endsWith('.png') ? name : `${name}.png`
    a.click()
    toast.success('Image downloaded')
  } catch (err) {
    failed(err)
  }
}

export async function exportElementAsPdf(el: HTMLElement, filename: string) {
  try {
    const [canvas, { jsPDF }] = await Promise.all([render(el), import('jspdf')])
    const imgData = canvas.toDataURL('image/png')
    const orientation = canvas.width > canvas.height ? 'l' : 'p'
    const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
    const name = safeName(filename)
    pdf.save(name.endsWith('.pdf') ? name : `${name}.pdf`)
    toast.success('PDF downloaded')
  } catch (err) {
    failed(err)
  }
}

/* ---------- Document exports ---------- */

/**
 * Renders a purpose-built export document (components/export/ExportDocs.tsx) off-screen, snapshots it and
 * removes it again. Unlike exporting an on-screen card, the layout is fixed-width and designed for paper.
 */
async function renderDocument(node: ReactNode) {
  const [{ createRoot }, { flushSync }] = await Promise.all([import('react-dom/client'), import('react-dom')])
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;z-index:-1;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(node))
    await document.fonts?.ready
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const el = host.firstElementChild as HTMLElement
    return await render(el)
  } finally {
    root.unmount()
    host.remove()
  }
}

function download(href: string, filename: string, ext: 'png' | 'pdf') {
  const name = safeName(filename)
  const a = document.createElement('a')
  a.href = href
  a.download = name.endsWith(`.${ext}`) ? name : `${name}.${ext}`
  a.click()
}

export async function exportDocument(node: ReactNode, filename: string, format: 'png' | 'pdf') {
  try {
    if (format === 'png') {
      const canvas = await renderDocument(node)
      download(canvas.toDataURL('image/png'), filename, 'png')
      toast.success('Image downloaded')
      return
    }
    const [canvas, { jsPDF }] = await Promise.all([renderDocument(node), import('jspdf')])
    // A4 portrait; long documents continue onto further pages at full width.
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const sliceH = Math.floor((canvas.width * pageH) / pageW)
    const bg = background()
    for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
      const part = document.createElement('canvas')
      part.width = canvas.width
      part.height = sliceH
      const ctx = part.getContext('2d')!
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, part.width, part.height)
      ctx.drawImage(canvas, 0, y, canvas.width, Math.min(sliceH, canvas.height - y), 0, 0, canvas.width, Math.min(sliceH, canvas.height - y))
      if (page > 0) pdf.addPage()
      pdf.addImage(part.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH)
    }
    const name = safeName(filename)
    pdf.save(name.endsWith('.pdf') ? name : `${name}.pdf`)
    toast.success('PDF downloaded')
  } catch (err) {
    failed(err)
  }
}
