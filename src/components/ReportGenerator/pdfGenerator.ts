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
      margin: 10mm 10mm 10mm 10mm; 
      size: A4 portrait;
    }
    body { 
      font-size: 11px; 
      line-height: 1.4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      width: 100% !important;
      max-width: none !important;
    }
    /* Ensure container elements don't restrict width */
    .max-w-4xl, .container {
      max-width: none !important;
      width: 100% !important;
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
      max-width: none !important;
      font-size: 10px !important;
      table-layout: auto !important;
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
      max-width: none !important;
      white-space: normal !important;
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
      display: block !important;
      max-width: none !important;
    }
    /* Fix responsive grid classes */
    .grid-cols-1, .grid-cols-2, .grid-cols-3, .md\\:grid-cols-2, .md\\:grid-cols-3 {
      display: block !important;
    }
    .grid-cols-1 > *, .grid-cols-2 > *, .grid-cols-3 > *, 
    .md\\:grid-cols-2 > *, .md\\:grid-cols-3 > * {
      display: block !important;
      width: 100% !important;
      margin-bottom: 12px !important;
      max-width: none !important;
    }
    .overflow-x-auto {
      overflow: visible !important;
      max-width: none !important;
    }
    /* Improve table responsiveness in PDF */
    .min-w-full {
      min-width: 100% !important;
      max-width: none !important;
    }
    /* Fix width constraints */
    .max-w-xs, .max-w-sm, .max-w-md, .max-w-lg, .max-w-xl, .max-w-2xl, .max-w-3xl, .max-w-4xl {
      max-width: none !important;
    }
    .divide-y {
      border-collapse: collapse !important;
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
    .space-y-6 > * + * {
      margin-top: 16px !important;
    }
    .space-y-8 > * + * {
      margin-top: 20px !important;
    }
    .mb-12 {
      margin-bottom: 16px !important;
      page-break-after: auto !important;
    }
    .pb-12 {
      padding-bottom: 12px !important;
    }
    /* Ensure section breaks for large content areas */
    .bg-white.p-8 {
      page-break-inside: auto !important;
      padding: 16px !important;
    }
    .max-w-4xl > div {
      page-break-inside: auto !important;
      max-width: none !important;
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
    
    // Use the prepareContent function to properly process the content
    const content = prepareContent(reportElement);
    
    // Configure PDF options with improved settings for A4 format
    const opt = {
      margin: [10, 10, 10, 10], // Reduced margins for more content space
      filename: `test-results-report-${new Date().toISOString().split("T")[0]}.pdf`,
      image: {
        type: "jpeg",
        quality: 0.98
      },
      html2canvas: {
        scale: 1.0, // Reduced scale to ensure content fits
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollY: -window.scrollY,
        windowWidth: 1200, // Increased width to capture more content
        windowHeight: window.innerHeight,
        onclone: doc => {
          // Ensure all content is visible and properly styled
          Array.from(doc.getElementsByTagName('*')).forEach(el => {
            const element = el as HTMLElement;
            element.style.overflow = 'visible';
            element.style.boxSizing = 'border-box';
            // Fix max-width constraints that might hide content
            if (element.style.maxWidth) {
              element.style.maxWidth = 'none';
            }
          });
          
          // Fix container widths
          const containers = doc.querySelectorAll('.max-w-4xl, .container');
          containers.forEach(container => {
            const elem = container as HTMLElement;
            elem.style.maxWidth = 'none';
            elem.style.width = '100%';
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
      const worker = window.html2pdf().from(content).set(opt);
      // Await the PDF generation to properly handle completion
      await worker.save();
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