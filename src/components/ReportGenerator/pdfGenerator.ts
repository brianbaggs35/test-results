interface Html2PdfOptions {
  margin: number[];
  filename: string;
  image: {
    type: string;
    quality: number;
  };
  html2canvas: {
    scale: number;
    useCORS: boolean;
    logging: boolean;
    letterRendering: boolean;
  };
  jsPDF: {
    unit: string;
    format: string;
    orientation: string;
  };
}
declare global {
  interface Window {
    html2pdf: any;
  }
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
  // Process SVG elements for better PDF rendering
  const svgs = content.getElementsByTagName("svg");
  Array.from(svgs).forEach(svg => {
    svg.setAttribute("width", "420"); // Consistent with chart processing
    svg.setAttribute("height", "280");
    svg.style.display = "block";
    svg.style.margin = "12px auto";
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
  });
  // Add PDF-specific styles
  const style = document.createElement("style");
  style.textContent = `
    @page { 
      margin: 20mm 15mm 20mm 15mm; 
      size: A4 portrait;
    }
    body { 
      font-size: 11px; 
      line-height: 1.4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    h1 { 
      font-size: 22px !important; 
      margin-bottom: 18px !important; 
      page-break-after: avoid !important;
      line-height: 1.2 !important;
    }
    h2 { 
      font-size: 18px !important; 
      margin-bottom: 14px !important; 
      margin-top: 24px !important;
      page-break-after: avoid !important;
      line-height: 1.3 !important;
    }
    h3 { 
      font-size: 14px !important; 
      margin-bottom: 10px !important; 
      margin-top: 16px !important;
      page-break-after: avoid !important;
    }
    h4 {
      font-size: 12px !important;
      margin-bottom: 8px !important;
      margin-top: 12px !important;
    }
    table { 
      page-break-inside: auto !important; 
      margin-bottom: 16px !important;
      width: 100% !important;
      max-width: 100% !important;
      font-size: 10px !important;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    tr { 
      page-break-inside: avoid !important; 
      page-break-after: auto !important;
    }
    td, th {
      padding: 6px 8px !important;
      word-wrap: break-word !important;
      max-width: 200px !important;
    }
    .page-break { 
      page-break-before: always !important; 
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
    svg { 
      max-width: 100% !important; 
      height: auto !important; 
      display: block !important;
      margin: 12px auto !important;
    }
    .grid {
      display: block !important;
    }
    .grid > div {
      margin-bottom: 12px !important;
      width: 100% !important;
    }
    .overflow-x-auto {
      overflow: visible !important;
    }
    .bg-gray-50, .bg-gray-100 {
      background-color: #f9fafb !important;
    }
    .bg-white {
      background-color: white !important;
    }
    .border, .border-b, .border-t {
      border-color: #e5e7eb !important;
    }
    .shadow {
      box-shadow: none !important;
    }
    p {
      margin-bottom: 8px !important;
      line-height: 1.4 !important;
    }
    ul, ol {
      margin-bottom: 12px !important;
    }
    li {
      margin-bottom: 4px !important;
    }
    .space-y-3 > * + * {
      margin-top: 8px !important;
    }
    .space-y-4 > * + * {
      margin-top: 12px !important;
    }
    .mb-12 {
      margin-bottom: 20px !important;
    }
    .pb-12 {
      padding-bottom: 16px !important;
    }
    * { 
      -webkit-print-color-adjust: exact !important; 
      color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
  `;
  content.insertBefore(style, content.firstChild);
  return content;
};
export const generatePDF = async (testData: any, config: any, onProgress?: (progress: number) => void): Promise<void> => {
  try {
    await loadHtml2Pdf();
    // Wait longer for charts and content to fully render
    await new Promise(resolve => setTimeout(resolve, 3000));
    const reportElement = document.getElementById("report-preview");
    if (!reportElement) throw new Error("Report content not found");
    // Create a deep clone of the content
    const content = reportElement.cloneNode(true) as HTMLElement;
    // Remove interactive elements
    const elementsToRemove = content.querySelectorAll('button, .print-hide, input, select, .recharts-tooltip-wrapper');
    elementsToRemove.forEach(el => el.remove());
    // Process charts for better PDF rendering
    const charts = content.querySelectorAll('.recharts-wrapper');
    charts.forEach(chart => {
      const svg = chart.querySelector('svg');
      if (svg) {
        // Set responsive chart dimensions that fit A4 page width
        svg.setAttribute('width', '420'); // Adjusted for A4 width (~170mm usable)
        svg.setAttribute('height', '280');
        svg.style.overflow = 'visible';
        svg.style.maxWidth = '100%';
        svg.style.height = 'auto';
      }
    });
    // Configure PDF options with improved settings for A4 format
    const opt = {
      margin: [20, 15, 20, 15], // Top, Right, Bottom, Left margins in mm for A4
      filename: `test-results-report-${new Date().toISOString().split("T")[0]}.pdf`,
      image: {
        type: "jpeg",
        quality: 0.95
      },
      html2canvas: {
        scale: 1.5, // Reduced scale for better performance and fitting
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollY: -window.scrollY,
        windowWidth: 800, // Optimized width for A4 pages
        height: window.innerHeight,
        onclone: doc => {
          // Ensure all content is visible and properly styled
          Array.from(doc.getElementsByTagName('*')).forEach(el => {
            const element = el as HTMLElement;
            element.style.overflow = 'visible';
            element.style.boxSizing = 'border-box';
          });
        }
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true
      },
      pagebreak: {
        mode: ['css', 'legacy'], // Enable CSS and legacy page breaks
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: ['tr', 'td', '.avoid-break']
      }
    };
    // Generate PDF with progress tracking
    try {
      const worker = window.html2pdf().from(content).set(opt).save();
      if (onProgress) {
        onProgress(100);
      }
    } catch (err) {
      console.error('PDF Generation failed:', err);
      throw new Error('Failed to generate PDF. Please try again.');
    }
  } catch (error) {
    console.error("Error in PDF generation:", error);
    throw error;
  }
};