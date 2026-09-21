/** Shared PNG/PDF export helpers for the Planner and Compare pages. */
import { toast } from 'sonner'

const BACKGROUND = '#0F0A0A'

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'loot-export'
}

async function render(el: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas')
  // Anything marked data-export-ignore (action buttons) is left out of the picture.
  return html2canvas(el, { backgroundColor: BACKGROUND, scale: 2, ignoreElements: (node) => node instanceof HTMLElement && node.hasAttribute('data-export-ignore') })
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
