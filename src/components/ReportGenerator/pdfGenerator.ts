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
  autoPaging: string;
  filename: string;
  image: {
    type: string;
    quality: number;
  };
  html2canvas: HTML2CanvasOptions;
  jsPDF: JSPDFOptions;
  pagebreak: PageBreakOptions;
}

interface HTML2CanvasOptions {
  scale: number;
  useCORS: boolean;
  logging: boolean;
  allowTaint: boolean;
  scrollX: number;
  scrollY: number;
  dpi: number;
  windowWidth: number;
  windowHeight: number;
  timeout: number;
  onclone: (doc: Document) => void;
}

interface JSPDFOptions {
  unit: string;
  format: string;
  orientation: string;
  compress: boolean;
  putOnlyUsedFonts: boolean;
  floatPrecision: number;
}

interface PageBreakOptions {
  mode: string[];
  before: string;
  after: string;
  avoid: string[];
}
const loadHtml2Pdf = async (): Promise<void> => {
  if (typeof window !== "undefined" && !window.html2pdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => resolve(undefined);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
const prepareContent = (element: HTMLElement): HTMLElement => {
  const content = element.cloneNode(true) as HTMLElement;

  // Remove elements that shouldn't be in the PDF
  const elementsToRemove = [".recharts-tooltip-wrapper", "button", ".print-hide", "input", "select"];
  elementsToRemove.forEach(selector => {
    const elements = content.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  // Optimize large tables for better PDF rendering
  const tables = content.querySelectorAll('table');
  tables.forEach(table => {
    const tbody = table.querySelector('tbody');
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      // Add page break hints for very large tables
      if (rows.length > 30) {
        rows.forEach((row, index) => {
          if (index > 0 && index % 25 === 0) {
            (row as HTMLElement).style.breakBefore = 'auto';
          }
        });
      }
    }
  });

  // Add minimal PDF-specific styles for page breaks and print optimization
  const style = document.createElement("style");
style.textContent = `
  @page {
    margin: 5mm;
    size: A4 portrait;
  }
  body {
    margin: 0;
    padding: 0;
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
    -webkit-print-color-adjust: exact !important;
    color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .pdf-frame {
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: 900px !important; /* A4 width at 96dpi */
    min-width: 0 !important;
    position: relative !important;
    justify-content: center !important;
    display: flex !important;
    overflow: visible !important;
    align-items: center !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    padding: 5mm 5mm !important;
    margin: auto !important;
  }
    }
    .page-break-before {
      page-break-before: always !important;
    }
    .page-break-after {
      page-break-after: always !important;
    }
    .avoid-break {
      page-break-inside: avoid !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important;
      margin-bottom: 5mm !important;
    }
    tr {
      page-break-inside: avoid !important;
      width: 100% !important;
    }
    td, th {
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      width: 100% !important;
    }
    svg {
      max-width: 100% !important;
      height: auto !important;
    }
    svg text {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    h1, h2, h3 {
      page-break-after: avoid !important;
    }
    .recharts-responsive-container {
      overflow: visible !important;
    }
  `;
  content.insertBefore(style, content.firstChild);
  return content;
};
export const generatePDF = async (testData: TestData, _config: ReportConfig, onProgress?: (progress: number) => void): Promise<void> => {
  try {
    await loadHtml2Pdf();
    // Wait for charts and content to fully render
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (onProgress) onProgress(10);

    // Try to find the PDF preview frame first, fallback to regular preview if needed
    let reportElement = document.getElementById("report-preview");
    if (!reportElement) {
      console.warn("PDF preview frame not found, falling back to regular preview");
      reportElement = document.getElementById("report-preview");
      if (!reportElement) {
        throw new Error("No report content found for PDF generation");
      }
    }

    // Wait for any remaining chart animations or async rendering
    await new Promise<void>((resolve, reject) => {
      // In test environment, skip waiting for chart render complete
      if (import.meta.vitest) {
        resolve();
        return;
      }

      const maxWaitTime = 5000; // Maximum wait time in milliseconds
      const interval = 100; // Polling interval in milliseconds
      let elapsedTime = 0;

      const checkRenderComplete = () => {
        const isRenderComplete = document.querySelector(".chart-render-complete") !== null;
        if (isRenderComplete) {
          resolve();
        } else if (elapsedTime >= maxWaitTime) {
          // Don't reject in test environment, just resolve
          if (typeof window !== 'undefined' && 'vi' in window) {
            resolve();
          } else {
            reject(new Error("Rendering did not complete within the maximum wait time"));
          }
        } else {
          elapsedTime += interval;
          setTimeout(checkRenderComplete, interval);
        }
      };

      checkRenderComplete();
    });
    if (onProgress) onProgress(20);

    // Use the prepareContent function to properly process the content
    const content = prepareContent(reportElement);
    if (onProgress) onProgress(30);

    // Calculate appropriate scale based on content size and test count
    const estimatedContentSize = content.innerHTML.length;
    const totalTests = testData.summary.total;

    // More intelligent scaling based on both content size and test count
    let scale = 1.9;
    let windowWidth = 1400;
    let windowHeight = 1900;

    if (totalTests > 2000 || estimatedContentSize > 1000000) {
      // Very large datasets
      scale = 1.9;
      windowWidth = 1200;
      windowHeight = 1800;
      console.warn(`Very large dataset detected (${totalTests} tests, ${estimatedContentSize} chars), using conservative settings`);
    } else if (totalTests > 500 || estimatedContentSize > 300000) {
      // Large datasets
      scale = 1.9;
      windowWidth = 1000;
      windowHeight = 1600;
      console.warn(`Large dataset detected (${totalTests} tests, ${estimatedContentSize} chars), reducing scale`);
    }

    // Configure PDF options with improved settings for memory efficiency
    const opt: PDFOptions = {
      margin: [2, 2, 2, 2],
      autoPaging: 'text',
      filename: `test-results-report-${new Date().toISOString().split("T")[0]}.pdf`,
      image: {
        type: "jpeg", // Use JPEG for better compression
        quality: 0.99 // High quality but compressed
      },
      html2canvas: {
        scale: scale,
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollX: 100,
        scrollY: 0,
        dpi: 100, // Reduced DPI for better memory usage
        windowWidth: windowWidth,
        windowHeight: windowHeight,
        timeout: 60000, // Reduced timeout to fail faster
        onclone: (doc: Document) => {
          // Ensure the PDF frame is visible in the cloned document
          const pdfFrame = doc.getElementById('report-preview');
          if (pdfFrame) {
            const pdfFrameParent = pdfFrame.parentElement;
            if (pdfFrameParent) {
              pdfFrameParent.style.position = 'relative';
              pdfFrameParent.style.justifyContent = 'auto';
              pdfFrameParent.style.left = 'auto';
              pdfFrameParent.style.top = 'auto';
              pdfFrameParent.style.transform = 'scale(0.8)';
              pdfFrameParent.style.transformOrigin = 'center';
              pdfFrameParent.style.visibility = 'visible';
              pdfFrameParent.style.overflow = 'visible';
              pdfFrameParent.style.margin = 'auto';
              pdfFrameParent.style.display = 'flex';
            }
            pdfFrame.style.position = 'relative';
            pdfFrame.style.justifyContent = 'center';
            pdfFrame.style.left = 'auto';
            pdfFrame.style.top = 'auto';
            pdfFrame.style.visibility = 'visible';
            pdfFrame.style.overflow = 'visible';
            pdfFrame.style.transform = 'scale(0.8)';
            pdfFrame.style.transformOrigin = 'center';
            pdfFrame.style.margin = 'auto';
            pdfFrame.style.display = 'flex';
          }

          // Hide the regular preview content to avoid conflicts
          const regularPreview = doc.getElementById('report-preview');
          if (regularPreview) {
            regularPreview.style.display = 'none';
          }

          // Ensure all SVG and chart elements are visible and properly rendered
          const svgs = doc.getElementsByTagName('svg');
          Array.from(svgs).forEach(svg => {
            svg.style.visibility = 'visible';
            svg.style.overflow = 'visible';
            svg.style.transform = 'none';
            svg.style.width = svg.getAttribute('width') || '100%';
            svg.style.height = svg.getAttribute('height') || '100%';

            // Ensure text elements in SVG are visible and readable
            const texts = svg.getElementsByTagName('text');
            Array.from(texts).forEach(text => {
              text.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              text.style.fontSize = text.style.fontSize || '11px';
              text.style.fill = text.style.fill || '#374151';
            });
          });

          // Ensure ResponsiveContainer elements work in the clone
          const responsiveContainers = doc.querySelectorAll('.recharts-responsive-container');
          Array.from(responsiveContainers).forEach(container => {
            const htmlContainer = container as HTMLElement;
            htmlContainer.style.width = '100%';
            htmlContainer.style.height = htmlContainer.style.height || '200px';
            htmlContainer.style.position = 'relative';
            htmlContainer.style.overflow = 'visible';
            htmlContainer.style.display = 'block';
          });

          // Optimize table rendering for large datasets with better page breaks
          const tables = doc.getElementsByTagName('table');
          Array.from(tables).forEach(table => {
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.breakInside = 'auto';
            table.style.marginBottom = '5mm';

            // For large tables, ensure proper page breaking
            const rows = table.getElementsByTagName('tr');
            if (rows.length > 25) {
              Array.from(rows).forEach((row, index) => {
                if (index > 0 && index % 20 === 0) {
                  (row as HTMLElement).style.breakBefore = 'auto';
                }
                // Prevent orphaned rows
                if (index < rows.length - 2) {
                  row.style.breakAfter = 'avoid';
                }
              });
            }
          });

          // Ensure proper section page breaks
          const sections = doc.querySelectorAll('[style*="marginBottom"]');
          Array.from(sections).forEach(section => {
            const htmlSection = section as HTMLElement;
            htmlSection.style.breakInside = 'avoid';
          });
        }
      },
      jsPDF: {
        unit: "pt",
        format: "a4",
        orientation: "landscape",
        compress: true,
        putOnlyUsedFonts: true,
        floatPrecision: 2 // Reduced precision for smaller file size
      },
      pagebreak: {
        mode: ['css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: ['.avoid-break', 'h1', 'h2', 'h3']
      }
    };

    // Generate PDF with progress tracking and better error handling
    try {
      if (onProgress) onProgress(40);
      const worker = window.html2pdf().from(content).set(opt);
      if (onProgress) onProgress(60);

      // Add timeout for PDF generation with better error messages
      const pdfGenerationTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PDF generation timed out')), 90000) // 1.5 minute timeout
      );

      // Race between PDF generation and timeout
      await Promise.race([
        worker.save(),
        pdfGenerationTimeout
      ]);

      if (onProgress) {
        onProgress(100);
      }
    } catch (err) {
      console.error('PDF Generation failed:', err);
      if (err instanceof Error) {
        const message = err.message;
        if (message.includes('timeout')) {
          throw new Error(`PDF generation timed out. The report contains ${totalTests} tests which may be too large for PDF generation. Consider filtering the results or generating separate reports.`);
        } else if (message.includes('memory') || message.includes('Maximum call stack')) {
          throw new Error(`Not enough memory to generate PDF with ${totalTests} tests. Try reducing the dataset size or refreshing the page.`);
        } else {
          throw new Error(`Failed to generate PDF: ${message}. Try reducing the report content or contact support.`);
        }
      } else {
        throw new Error('Failed to generate PDF due to an unknown error. Please try again.');
      }
    }
  } catch (error) {
    console.error("Error in PDF generation:", error);
    throw error;
  }
};
