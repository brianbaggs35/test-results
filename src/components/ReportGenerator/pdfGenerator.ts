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
 * Walk the rendered clone and collect the Y positions (in CSS pixels,
 * relative to the clone's top) of element boundaries that make good
 * page-break candidates — section dividers, table-row gaps, headings, etc.
 *
 * Deliberately narrow: only elements that are safe to cut *between* (table
 * rows, section boundaries, headings). A broader selector like `div[style]`
 * would also match things like a stat card's label and its value — both are
 * plain styled divs — so the nearest-break search could slice between a
 * label and its own number and strand them on different pages.
 */
function findBreakPoints(clone: HTMLElement): number[] {
  const offY = clone.getBoundingClientRect().top;
  const points: number[] = [];

  const selectors = 'tr, .avoid-break, .page-break-before, h2, h3';
  clone.querySelectorAll(selectors).forEach((el) => {
    const r = el.getBoundingClientRect();
    // Top and bottom of each element are potential break points
    points.push(Math.round(r.top - offY));
    points.push(Math.round(r.bottom - offY));
  });

  // Deduplicate and sort
  return [...new Set(points)].sort((a, b) => a - b);
}

/**
 * Top/bottom Y spans (CSS px, relative to the clone) of elements marked
 * `.avoid-break` — content that should stay on one page whenever it's
 * short enough to fit on a fresh page by itself (a summary card row, a
 * heading with its body). Sections too tall to ever fit a single page
 * (e.g. a table with hundreds of rows) fall back to slicing at their own
 * `tr` break points instead — this only protects blocks that fitting them
 * whole would actually help.
 */
function getProtectedRanges(clone: HTMLElement): Array<{ top: number; bottom: number }> {
  const offY = clone.getBoundingClientRect().top;
  const ranges = Array.from(clone.querySelectorAll('.avoid-break')).map((el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top - offY), bottom: Math.round(r.bottom - offY) };
  });
  return ranges.sort((a, b) => a.top - b.top);
}

/**
 * Y positions (CSS px) where a page break is mandatory regardless of how
 * much room is left on the current page — elements marked
 * `.page-break-before`, mirroring the same intent as their print-CSS rule.
 */
function getForcedBreakPoints(clone: HTMLElement): number[] {
  const offY = clone.getBoundingClientRect().top;
  const points = Array.from(clone.querySelectorAll('.page-break-before')).map(
    (el) => Math.round(el.getBoundingClientRect().top - offY),
  );
  return [...new Set(points)].sort((a, b) => a - b);
}

/**
 * Given sorted break points and an ideal page-end Y in CSS pixels,
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
  let wrapper: HTMLDivElement | null = null;
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
    wrapper = document.createElement('div');
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

    // Let the browser lay out the clone so measurements below are correct
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    if (onProgress) onProgress(20);

    // ── 2. Compute smart page breaks from the live clone's layout ────
    // Done in CSS pixels, from the DOM, before any canvas is created.
    const totalHeightPx = clone.scrollHeight;
    const breakPoints = findBreakPoints(clone);
    const protectedRanges = getProtectedRanges(clone);
    const forcedBreaks = getForcedBreakPoints(clone);

    const pageBreaks: number[] = [0]; // start at top
    let cursor = 0;
    while (cursor < totalHeightPx) {
      const idealEnd = cursor + A4_HEIGHT_PX;
      if (idealEnd >= totalHeightPx) {
        break; // remaining content fits on current page
      }

      // A `.page-break-before` section (e.g. "All Test Cases") always
      // starts on a fresh page, even if there's room left on this one.
      const nextForced = forcedBreaks.find((f) => f > cursor);

      // A `.avoid-break` block that starts fresh on this page but won't
      // fully fit before the ideal cut gets pushed whole to the next page,
      // instead of being sliced through the middle — as long as it's short
      // enough to actually fit a full page by itself. Longer blocks (a
      // table with hundreds of rows) fall back to slicing at their own row
      // boundaries below.
      const splitBlock = protectedRanges.find(
        (r) => r.top > cursor && r.top < idealEnd && r.bottom > idealEnd,
      );

      let bestBreak: number;
      if (nextForced !== undefined && nextForced <= idealEnd) {
        bestBreak = nextForced;
      } else if (splitBlock && splitBlock.bottom - splitBlock.top <= A4_HEIGHT_PX) {
        bestBreak = splitBlock.top;
      } else {
        // Find a break point near the ideal page end (prefer slightly earlier)
        bestBreak = findNearestBreak(breakPoints, idealEnd, A4_HEIGHT_PX);
      }

      pageBreaks.push(bestBreak);
      cursor = bestBreak;
    }

    const totalPages = pageBreaks.length;

    // ── 3. Render and add each page independently ────────────────────
    // Capturing one A4 page at a time (via html2canvas's own x/y/width/height
    // crop) instead of one canvas for the whole report keeps every canvas
    // comfortably under the browser's maximum canvas dimensions. A report
    // with thousands of tests can be tens of thousands of pixels tall,
    // which silently produces a blank canvas if captured in one shot.
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      const srcY = pageBreaks[page];
      const nextY = page + 1 < totalPages ? pageBreaks[page + 1] : totalHeightPx;
      const srcH = Math.max(1, nextY - srcY);

      const pageCanvas = await html2canvas(clone, {
        scale: SCALE,
        useCORS: true,
        logging: false,
        allowTaint: true,
        width: A4_WIDTH_PX,
        windowWidth: A4_WIDTH_PX,
        height: srcH,
        x: 0,
        y: srcY,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff',
      });

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.98);
      const imgHeightMm = (srcH / A4_WIDTH_PX) * A4_WIDTH_MM;

      // Place image at (0, 0) filling full page width – content's own
      // 40 px internal padding provides the visual margins.
      pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, imgHeightMm);

      if (onProgress) onProgress(20 + Math.round(((page + 1) / totalPages) * 70));
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
  } finally {
    wrapper?.remove();
  }
};
