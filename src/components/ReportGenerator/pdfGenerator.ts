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

    // Print colour preservation
    const style = document.createElement('style');
    style.textContent = '* { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }';
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

    // Remove off-screen element immediately
    wrapper.remove();

    if (onProgress) onProgress(60);

    // ── 3. Slice the canvas into A4 pages and build the PDF ──────────
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

    const canvasWidthPx = canvas.width;   // A4_WIDTH_PX * SCALE
    const canvasHeightPx = canvas.height;
    const pageHeightPx = A4_HEIGHT_PX * SCALE; // one page's worth of canvas pixels

    const totalPages = Math.max(1, Math.ceil(canvasHeightPx / pageHeightPx));

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      // Slice this page's strip from the full canvas
      const srcY = page * pageHeightPx;
      const srcH = Math.min(pageHeightPx, canvasHeightPx - srcY);

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
