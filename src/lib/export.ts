/** Shared PNG/PDF export helpers for the Planner and Compare pages. */

export async function exportElementAsPng(el: HTMLElement, filename: string) {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(el, { backgroundColor: '#0F0A0A', scale: 2 })
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  a.click()
}

export async function exportElementAsPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  const canvas = await html2canvas(el, { backgroundColor: '#0F0A0A', scale: 2 })
  const imgData = canvas.toDataURL('image/png')
  const orientation = canvas.width > canvas.height ? 'l' : 'p'
  const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] })
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
