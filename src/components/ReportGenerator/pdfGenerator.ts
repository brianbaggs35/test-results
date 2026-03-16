import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { TestData, ReportConfig } from '../../types';

declare global {
  interface ImportMeta {
    vitest?: boolean;
  }
}

// A4 dimensions
const A4_WIDTH_MM = 210;
const A4_WIDTH_PX = 794;   // 210mm at 96 DPI
const A4_HEIGHT_PX = 1123;  // 297mm at 96 DPI
const SCALE = 2;             // hi-DPI canvas scale

/**
 * Walk the rendered clone and collect the Y positions (in *canvas* pixels)
 * of element boundaries that make good page-break candidates — section
 * dividers, table-row gaps, headings, etc.
 */
function findBreakPoints(clone: HTMLElement, _a4HeightPx: number, scale: number): number[] {
  const cloneRect = clone.getBoundingClientRect();
  const offY = cloneRect.top;
  const points: number[] = [];

  // Collect bottom edges of sections, table rows, avoid-break elements
  const selectors = 'tr, .avoid-break, .page-break-before, h2, h3, div[style]';
  clone.querySelectorAll(selectors).forEach((el) => {
    const r = el.getBoundingClientRect();
    // Top and bottom of each element are potential break points
    points.push(Math.round((r.top - offY) * scale));
    points.push(Math.round((r.bottom - offY) * scale));
  });

  // Deduplicate and sort
  return [...new Set(points)].sort((a, b) => a - b);
}

/**
 * Given sorted break points and an ideal page-end Y in canvas pixels,
 * find the nearest safe break point. Prefer a break that is above the
 * ideal line (so content isn't cut) within a tolerance margin.
 */
function findNearestBreak(
  breakPoints: number[],
  idealY: number,
  pageHeightPx: number,
): number {
  // Search within 15% of page height above the ideal line
  const tolerance = pageHeightPx * 0.15;
  const minY = idealY - tolerance;

  let best = idealY; // fallback to exact page boundary
  let bestDist = Infinity;

  for (const bp of breakPoints) {
    if (bp < minY) continue;
    if (bp > idealY) break; // past the ideal – stop searching
    const dist = idealY - bp;
    if (dist < bestDist) {
      bestDist = dist;
      best = bp;
    }
  }

  return best;
}

export const generatePDF = async (
  testData: TestData,
  _config: ReportConfig,
  onProgress?: (progress: number) => void,
): Promise<void> => {
  try {
    if (onProgress) onProgress(5);

    const reportElement = document.getElementById('report-preview');
    if (!reportElement) {
      throw new Error('No report content found for PDF generation');
    }

    // Wait for chart rendering
    await new Promise<void>((resolve, reject) => {
      if (import.meta.vitest) { resolve(); return; }
      const maxWait = 5000;
      let elapsed = 0;
      const check = () => {
        if (document.querySelector('.chart-render-complete')) { resolve(); }
        else if (elapsed >= maxWait) {
          if (typeof window !== 'undefined' && 'vi' in window) { resolve(); }
          else { reject(new Error('Rendering did not complete within the maximum wait time')); }
        } else { elapsed += 100; setTimeout(check, 100); }
      };
      check();
    });

    if (onProgress) onProgress(10);

    // ── 1. Build a clean off-screen clone ────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:fixed;left:0;top:0;width:794px;z-index:-9999;' +
      'pointer-events:none;overflow:visible;background:white;';

    const clone = reportElement.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id'); // avoid duplicate IDs
    clone.style.cssText =
      'width:794px;max-width:794px;padding:0;margin:0;' +
      'box-sizing:border-box;background:white;overflow:visible;' +
      'transform:none;position:static;';

    // Strip interactive elements
    ['.recharts-tooltip-wrapper', 'button', '.print-hide', 'input', 'select'].forEach((s) =>
      clone.querySelectorAll(s).forEach((el) => el.remove()),
    );

    // Ensure SVGs render fully
    clone.querySelectorAll('svg').forEach((svg) => {
      (svg as SVGSVGElement).style.overflow = 'visible';
    });

    // Print colour preservation + page-break rules for clean slicing
    const style = document.createElement('style');
    style.textContent = [
      '* { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }',
      '.avoid-break, table, tr, .section-wrapper { page-break-inside:avoid; break-inside:avoid; }',
      '.page-break-before { page-break-before:always; break-before:page; }',
    ].join('\n');
    clone.insertBefore(style, clone.firstChild);

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // Let the browser lay out the clone so html2canvas gets correct geometry
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    if (onProgress) onProgress(20);

    // ── 2. Capture the clone with html2canvas ────────────────────────
    const canvas = await html2canvas(clone, {
      scale: SCALE,
      useCORS: true,
      logging: false,
      allowTaint: true,
      width: A4_WIDTH_PX,
      windowWidth: A4_WIDTH_PX,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: '#ffffff',
    });

    // ── 3. Compute smart page breaks ─────────────────────────────────
    // Scan clone's child elements to find good break points so we don't
    // slice through table rows or sections.
    const breakPoints = findBreakPoints(clone, A4_HEIGHT_PX, SCALE);

    // Remove off-screen element immediately
    wrapper.remove();

    if (onProgress) onProgress(60);

    // ── 4. Slice the canvas into A4 pages and build the PDF ──────────
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

    const canvasWidthPx = canvas.width;   // A4_WIDTH_PX * SCALE
    const canvasHeightPx = canvas.height;
    const pageHeightPx = A4_HEIGHT_PX * SCALE; // one page's worth of canvas pixels

    // Build page boundaries using smart break points
    const pageBreaks: number[] = [0]; // start at top
    let cursor = 0;
    while (cursor < canvasHeightPx) {
      const idealEnd = cursor + pageHeightPx;
      if (idealEnd >= canvasHeightPx) {
        break; // remaining content fits on current page
      }
      // Find a break point near the ideal page end (prefer slightly earlier)
      const bestBreak = findNearestBreak(breakPoints, idealEnd, pageHeightPx);
      pageBreaks.push(bestBreak);
      cursor = bestBreak;
    }

    const totalPages = pageBreaks.length;

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      // Slice this page's strip from the full canvas
      const srcY = pageBreaks[page];
      const nextY = page + 1 < totalPages ? pageBreaks[page + 1] : canvasHeightPx;
      const srcH = nextY - srcY;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvasWidthPx;
      pageCanvas.height = srcH;
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidthPx, srcH);
        ctx.drawImage(canvas, 0, srcY, canvasWidthPx, srcH, 0, 0, canvasWidthPx, srcH);
      }

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.98);
      const imgHeightMm = (srcH / canvasWidthPx) * A4_WIDTH_MM;

      // Place image at (0, 0) filling full page width – content's own
      // 40 px internal padding provides the visual margins.
      pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, imgHeightMm);

      if (onProgress) onProgress(60 + Math.round(((page + 1) / totalPages) * 30));
    }

    // ── 4. Save ──────────────────────────────────────────────────────
    const filename = `test-results-report-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);

    if (onProgress) onProgress(100);
  } catch (err) {
    console.error('PDF generation error:', err);
    if (err instanceof Error) {
      if (err.message.includes('timeout')) {
        throw new Error('PDF generation timed out. The report may be too large. Consider filtering results.');
      } else if (err.message.includes('memory') || err.message.includes('Maximum call stack')) {
        throw new Error(`Not enough memory to generate PDF with ${testData.summary.total} tests. Try reducing the dataset.`);
      } else {
        throw new Error(`Failed to generate PDF: ${err.message}`);
      }
    } else {
      throw new Error('Failed to generate PDF due to an unknown error. Please try again.');
    }
  }
};
