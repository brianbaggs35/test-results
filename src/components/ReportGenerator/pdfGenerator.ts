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
      const svg = chart.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '500');
        svg.setAttribute('height', '300');
        svg.style.overflow = 'visible';
      }
    });
    // Configure PDF options with improved settings
    const opt = {
      margin: [15, 15, 15, 15],
      // Increased margins
      filename: `test-results-report-${new Date().toISOString().split("T")[0]}.pdf`,
      image: {
        type: "jpeg",
        quality: 0.98
      },
      // Increased quality
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollY: -window.scrollY,
        // Fix for scrolled content
        windowWidth: 1200,
        // Fixed width for consistent rendering
        onclone: doc => {
          // Ensure all content is visible
          Array.from(doc.getElementsByTagName('*')).forEach(el => {
            const element = el as HTMLElement;
            element.style.overflow = 'visible';
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
        mode: 'avoid-all'
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