/**
 * Opens an off-screen report sheet alone in a print window, where "Save as PDF" makes the file (the browser draws
 * Khmer correctly, which a hand-built PDF would not). The page's own styles and fonts (Kantumruy Pro) are copied
 * across, and the browser cuts the sheet into A4 landscape pages where a block allows it.
 */
/** The sheet is drawn this wide (px) and scaled to fit an A4 page lying down (landscape), about 277 mm across. */
export const PRINT_WIDTH = 1480;
const PRINT_ZOOM = 0.7;

export function printSheet(el: HTMLElement, opts: { title: string; language: string; /** Page footer: left text, and the words around the page number. */ footer?: { left: string; page: string; of: string } }) {
  const w = window.open('', '_blank');
  if (!w) return false;
  // Read the rules the browser holds (the dev server adds styles that way, so copying the <style> tags would copy nothing).
  const css = [...document.styleSheets].map(sheet => {
    try { return [...sheet.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; }
  }).join('\n');
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map(n => n.outerHTML).join('\n');
  const f = opts.footer;
  const footerCss = f ? `;@bottom-left{content:"${f.left.replace(/"/g, '')}";font:10px sans-serif;color:#64748b}@bottom-right{content:"${f.page} " counter(page) " ${f.of} " counter(pages);font:10px sans-serif;color:#64748b}` : '';
  // A4 landscape: the sheet is scaled to the page width, and the browser breaks it where a block says it may.
  w.document.write(`<!doctype html><html lang="${opts.language}" class="${document.documentElement.className}"><head><meta charset="utf-8"><title>${opts.title.replace(/</g, '')}</title><base href="${location.origin}/">${links}
<style>${css}</style>
<style>@page{size:A4 landscape;margin:10mm 10mm 14mm${footerCss}}html,body{background:#fff;margin:0}body{width:${PRINT_WIDTH}px;zoom:${PRINT_ZOOM};font-family:var(--font-sans),system-ui,sans-serif}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.pdf-block{break-inside:avoid}.pdf-break{break-before:page}</style>
</head><body class="font-sans">${el.outerHTML}</body></html>`);
  w.document.close();
  // Let the styles and fonts load before the print window opens.
  setTimeout(() => { w.focus(); w.print(); }, 900);
  return true;
}
