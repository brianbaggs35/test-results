import { TestData, ReportConfig } from '../../types';

declare global {
  interface Window {
    html2pdf: HTMLToPDFApi;
  }
  interface ImportMeta {
    vitest?: boolean;
  }
}

interface HTMLToPDFApi {
  (): HTMLToPDFWorker;
}

interface HTMLToPDFWorker {
  from(element: HTMLElement): HTMLToPDFWorker;
  set(options: PDFOptions): HTMLToPDFWorker;
  save(): Promise<void>;
}

interface PDFOptions {
  margin: number[];
  filename: string;
  image: { type: string; quality: number };
  html2canvas: HTML2CanvasOptions;
  jsPDF: JSPDFOptions;
  pagebreak: PageBreakOptions;
}

interface HTML2CanvasOptions {
  scale: number;
  useCORS: boolean;
  logging: boolean;
  allowTaint: boolean;
  windowWidth: number;
  onclone: (doc: Document) => void;
}

interface JSPDFOptions {
  unit: string;
  format: string;
  orientation: string;
  compress: boolean;
}

interface PageBreakOptions {
  mode: string[];
  before: string;
  after: string;
  avoid: string[];
}

const loadHtml2Pdf = async (): Promise<void> => {
  if (typeof window !== 'undefined' && !window.html2pdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve(undefined);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

/**
 * All content preparation happens inside the html2canvas `onclone` callback
 * so that the cloned element lives in a proper document context. Modifying
 * a detached clone and handing it to html2canvas causes layout computation
 * failures (elements clipped on the left / misaligned).
 */
const prepareClonedContent = (doc: Document): void => {
  const content = doc.getElementById('report-preview');
  if (!content) return;

  // Neutralise ancestor transforms (e.g. the scale(0.82) preview wrapper)
  // so html2canvas renders the content at its natural 794 px width.
  let parent = content.parentElement;
  while (parent && parent !== doc.body) {
    parent.style.transform = 'none';
    parent.style.webkitTransform = 'none';
    parent.style.overflow = 'visible';
    parent.style.maxHeight = 'none';
    parent = parent.parentElement;
  }

  // Fix the root element dimensions
  content.style.width = '794px';
  content.style.maxWidth = '794px';
  content.style.padding = '0';
  content.style.margin = '0';
  content.style.boxSizing = 'border-box';
  content.style.backgroundColor = 'white';
  content.style.overflow = 'hidden';
  content.style.position = 'relative';

  // Remove interactive / tooltip elements
  const removeSelectors = [
    '.recharts-tooltip-wrapper',
    'button',
    '.print-hide',
    'input',
    'select',
  ];
  removeSelectors.forEach((sel) => {
    content.querySelectorAll(sel).forEach((el) => el.remove());
  });

  // Page-break hints for large tables
  content.querySelectorAll('table').forEach((table) => {
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length > 30) {
      rows.forEach((row, i) => {
        if (i > 0 && i % 25 === 0) {
          (row as HTMLElement).style.breakBefore = 'auto';
        }
      });
    }
  });

  // Fix SVGs
  const svgs = doc.getElementsByTagName('svg');
  Array.from(svgs).forEach((svg) => {
    svg.style.overflow = 'visible';
  });

  // Inject print styles
  const style = doc.createElement('style');
  style.textContent = [
    '@page { margin: 10mm; size: A4 portrait; }',
    '* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }',
    '.page-break-before { page-break-before: always !important; }',
    '.page-break-after { page-break-after: always !important; }',
    '.avoid-break { page-break-inside: avoid !important; }',
    'table { width: 100% !important; border-collapse: collapse !important; page-break-inside: auto !important; }',
    'tr { page-break-inside: avoid !important; }',
    'h1, h2, h3 { page-break-after: avoid !important; }',
    'svg { max-width: 100% !important; overflow: visible !important; }',
    '.recharts-responsive-container { width: 100% !important; position: relative !important; }',
  ].join('\n');
  content.insertBefore(style, content.firstChild);
};

export const generatePDF = async (
  testData: TestData,
  _config: ReportConfig,
  onProgress?: (progress: number) => void,
): Promise<void> => {
  try {
    await loadHtml2Pdf();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (onProgress) onProgress(10);

    const reportElement = document.getElementById('report-preview');
    if (!reportElement) {
      throw new Error('No report content found for PDF generation');
    }

    // Wait for chart rendering
    await new Promise<void>((resolve, reject) => {
      if (import.meta.vitest) {
        resolve();
        return;
      }

      const maxWait = 5000;
      let elapsed = 0;
      const interval = 100;

      const check = () => {
        if (document.querySelector('.chart-render-complete')) {
          resolve();
        } else if (elapsed >= maxWait) {
          if (typeof window !== 'undefined' && 'vi' in window) {
            resolve();
          } else {
            reject(new Error('Rendering did not complete within the maximum wait time'));
          }
        } else {
          elapsed += interval;
          setTimeout(check, interval);
        }
      };
      check();
    });

    if (onProgress) onProgress(20);
    if (onProgress) onProgress(30);

    // html2canvas reads getBoundingClientRect() on the LIVE element to
    // decide what area to capture.  The preview wrapper applies
    // scale(0.82) which shrinks the visual rect, causing the captured
    // area to be narrower than the 794 px content – clipping the left
    // (and right) edges.  We temporarily strip transforms / overflow
    // constraints from ancestors so the bounding rect is the true
    // 794 px, then restore them after generation.
    const savedStyles: { el: HTMLElement; transform: string; webkitTransform: string; overflow: string; maxHeight: string; marginBottom: string }[] = [];
    let ancestor = reportElement.parentElement;
    while (ancestor) {
      savedStyles.push({
        el: ancestor,
        transform: ancestor.style.transform,
        webkitTransform: ancestor.style.webkitTransform,
        overflow: ancestor.style.overflow,
        maxHeight: ancestor.style.maxHeight,
        marginBottom: ancestor.style.marginBottom,
      });
      ancestor.style.transform = 'none';
      ancestor.style.webkitTransform = 'none';
      ancestor.style.overflow = 'visible';
      ancestor.style.maxHeight = 'none';
      ancestor.style.marginBottom = '0px';
      ancestor = ancestor.parentElement;
    }

    // A4 at 96 DPI = 794px width. Scale 2 for crisp rendering.
    const opt: PDFOptions = {
      margin: [10, 10, 10, 10],
      filename: `test-results-report-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        windowWidth: 794,
        onclone: (doc: Document) => {
          prepareClonedContent(doc);
        },
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true,
      },
      pagebreak: {
        mode: ['css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: ['.avoid-break', 'h1', 'h2', 'h3'],
      },
    };

    if (onProgress) onProgress(40);

    const worker = window.html2pdf().from(reportElement).set(opt);

    if (onProgress) onProgress(60);

    const restoreStyles = () => {
      for (const s of savedStyles) {
        s.el.style.transform = s.transform;
        s.el.style.webkitTransform = s.webkitTransform;
        s.el.style.overflow = s.overflow;
        s.el.style.maxHeight = s.maxHeight;
        s.el.style.marginBottom = s.marginBottom;
      }
    };

    if (onProgress) onProgress(60);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF generation timed out')), 90000),
    );

    try {
      await Promise.race([worker.save(), timeout]);
    } finally {
      restoreStyles();
    }

    if (onProgress) onProgress(100);
  } catch (err) {
    console.error('PDF generation error:', err);
    if (err instanceof Error) {
      if (err.message.includes('timeout')) {
        throw new Error(
          'PDF generation timed out. The report may be too large. Consider filtering results.',
        );
      } else if (err.message.includes('memory') || err.message.includes('Maximum call stack')) {
        throw new Error(
          `Not enough memory to generate PDF with ${testData.summary.total} tests. Try reducing the dataset.`,
        );
      } else {
        throw new Error(`Failed to generate PDF: ${err.message}`);
      }
    } else {
      throw new Error('Failed to generate PDF due to an unknown error. Please try again.');
    }
  }
};
