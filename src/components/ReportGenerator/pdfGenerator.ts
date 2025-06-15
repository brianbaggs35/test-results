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
    allowTaint?: boolean;
    scrollY?: number;
    windowWidth?: number;
    windowHeight?: number;
    onclone?: (doc: Document) => void;
  };
  jsPDF: {
    unit: string;
    format: string;
    orientation: string;
    compress?: boolean;
  };
  pagebreak?: {
    mode: string[];
    before: string;
    after: string;
    avoid: string[];
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

  // Add minimal PDF-specific styles for page breaks and print optimization
  const style = document.createElement("style");
  style.textContent = `
    @page { 
      margin: 5mm 4mm 5mm 5mm; 
      size: A4 portrait;
    }
    body { 
      margin: 0;
      padding: 0;
      width: 100% !important;
      max-width: none !important;
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .pdf-frame {
      box-sizing: border-box !important;
      overflow: visible !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
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
      page-break-inside: avoid !important;
      border-collapse: collapse !important;
    }
    tr {
      page-break-inside: avoid !important;
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
  `;
  content.insertBefore(style, content.firstChild);
  return content;
};
export const generatePDF = async (testData: any, config: any, onProgress?: (progress: number) => void): Promise<void> => {
  try {
    await loadHtml2Pdf();
    // Wait longer for charts and content to fully render
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Ensure all async content is loaded
    if (onProgress) onProgress(10);
    
    // Try to find the PDF preview frame first, fallback to regular preview if needed
    let reportElement = document.getElementById("pdf-preview-frame");
    if (!reportElement) {
      console.warn("PDF preview frame not found, falling back to regular preview");
      reportElement = document.getElementById("report-preview");
      if (!reportElement) {
        throw new Error("No report content found for PDF generation");
      }
    }
    
    // Wait for any remaining chart animations or async rendering
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (onProgress) onProgress(20);
    
    // Use the prepareContent function to properly process the content
    const content = prepareContent(reportElement);
    if (onProgress) onProgress(30);
    
    // Configure PDF options with improved settings for A4 format
    const opt = {
      margin: [5, 4, 5, 5], // Reduced right margin to give more content space
      filename: `test-results-report-${new Date().toISOString().split("T")[0]}.pdf`,
      image: {
        type: "png", // PNG for better quality than JPEG
        quality: 1.0 // Maximum quality
      },
      html2canvas: {
        scale: 2.0, // Higher scale for better clarity (2x DPI)
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollY: 0,
        dpi: 300, // Higher DPI for print quality
        windowWidth: 1600, // Larger canvas for better resolution (roughly 2x)
        windowHeight: 2260, // Corresponding height
        onclone: (doc: any) => {
          // Ensure the PDF frame is visible in the cloned document
          const pdfFrame = doc.getElementById('pdf-preview-frame');
          if (pdfFrame) {
            const pdfFrameParent = pdfFrame.parentElement;
            if (pdfFrameParent) {
              pdfFrameParent.style.position = 'static';
              pdfFrameParent.style.left = 'auto';
              pdfFrameParent.style.top = 'auto';
              pdfFrameParent.style.visibility = 'visible';
              pdfFrameParent.style.overflow = 'visible';
            }
            pdfFrame.style.position = 'static';
            pdfFrame.style.left = 'auto';
            pdfFrame.style.top = 'auto';
            pdfFrame.style.visibility = 'visible';
            pdfFrame.style.overflow = 'visible';
            pdfFrame.style.transform = 'none';
          }
          
          // Hide the regular preview content to avoid conflicts
          const regularPreview = doc.getElementById('report-preview');
          if (regularPreview) {
            regularPreview.style.display = 'none';
          }
          
          // Ensure all SVG and chart elements are visible and properly rendered
          const svgs = doc.getElementsByTagName('svg');
          Array.from(svgs).forEach((svg: any) => {
            svg.style.visibility = 'visible';
            svg.style.overflow = 'visible';
            svg.style.transform = 'none';
            svg.style.width = svg.getAttribute('width') || '100%';
            svg.style.height = svg.getAttribute('height') || '100%';
            
            // Ensure text elements in SVG are visible and readable
            const texts = svg.getElementsByTagName('text');
            Array.from(texts).forEach((text: any) => {
              text.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              text.style.fontSize = text.style.fontSize || '11px';
              text.style.fill = text.style.fill || '#374151';
            });
          });
          
          // Ensure ResponsiveContainer elements work in the clone
          const responsiveContainers = doc.querySelectorAll('.recharts-responsive-container');
          Array.from(responsiveContainers).forEach((container: any) => {
            container.style.width = '100%';
            container.style.height = container.style.height || '180px';
            container.style.position = 'relative';
            container.style.overflow = 'visible';
            container.style.display = 'block';
          });

          // Improve table rendering
          const tables = doc.getElementsByTagName('table');
          Array.from(tables).forEach((table: any) => {
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.pageBreakInside = 'avoid';
          });

          // Ensure proper page breaks
          const sections = doc.querySelectorAll('[style*="pageBreakInside"]');
          Array.from(sections).forEach((section: any) => {
            section.style.pageBreakInside = 'avoid';
          });
        }
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
        putOnlyUsedFonts: true, // Optimize font loading
        floatPrecision: 16 // Better precision for layout
      },
      pagebreak: {
        mode: ['css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: ['tr', 'td', '.avoid-break', 'table', 'img', 'svg'] // Better page break handling
      }
    };
    // Generate PDF with progress tracking
    try {
      if (onProgress) onProgress(40);
      const worker = window.html2pdf().from(content).set(opt);
      if (onProgress) onProgress(60);
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