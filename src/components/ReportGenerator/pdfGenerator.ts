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
  // Process SVG elements
  const svgs = content.getElementsByTagName("svg");
  Array.from(svgs).forEach(svg => {
    svg.setAttribute("width", "500");
    svg.setAttribute("height", "300");
    svg.style.display = "block";
    svg.style.margin = "20px auto";
  });
  // Add PDF-specific styles
  const style = document.createElement("style");
  style.textContent = `
    @page { margin: 10mm; }
    body { font-size: 12px; }
    h1 { font-size: 24px !important; margin-bottom: 20px !important; }
    h2 { font-size: 20px !important; margin-bottom: 15px !important; }
    h3 { font-size: 16px !important; margin-bottom: 10px !important; }
    table { page-break-inside: avoid !important; margin-bottom: 20px !important; }
    tr { page-break-inside: avoid !important; }
    .page-break { page-break-before: always !important; }
    svg { max-width: 100% !important; height: auto !important; }
    * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; print-color-adjust: exact !important; }
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
    // Process charts
    const charts = content.querySelectorAll('.recharts-wrapper');
    charts.forEach(chart => {
      chart.setAttribute('width', '500');
      chart.setAttribute('height', '300');
      const svg = chart.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '500');
        svg.setAttribute('height', '300');
        svg.style.overflow = 'visible';
      }
    });
    // Add print styles
    const style = document.createElement('style');
    style.textContent = `
      @page { margin: 20mm; }
      body { font-size: 12px; }
      h1 { font-size: 24px !important; margin-bottom: 20px !important; }
      h2 { font-size: 20px !important; margin-bottom: 15px !important; }
      h3 { font-size: 16px !important; margin-bottom: 10px !important; }
      table { page-break-inside: avoid !important; margin-bottom: 20px !important; width: 100% !important; }
      tr { page-break-inside: avoid !important; }
      td, th { padding: 8px !important; text-align: left !important; }
      .page-break { page-break-before: always !important; }
      * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; print-color-adjust: exact !important; }
    `;
    content.insertBefore(style, content.firstChild);
    // Configure PDF options
    const opt = {
      margin: 10,
      filename: `test-results-report-${new Date().toISOString().split("T")[0]}.pdf`,
      image: {
        type: "jpeg",
        quality: 1
      },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: true,
        allowTaint: true,
        foreignObjectRendering: true,
        imageTimeout: 0,
        removeContainer: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      }
    };
    // Generate PDF with error handling
    try {
      const worker = window.html2pdf();
      await worker.set(opt).from(content).save();
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