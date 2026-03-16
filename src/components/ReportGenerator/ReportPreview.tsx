import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeftIcon, DownloadIcon, LoaderIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react';
import { generatePDF } from './pdfGenerator';
import { PDFPreviewFrame } from './PDFPreviewFrame';
import { TestData, ReportConfig } from '../../types';

const A4_HEIGHT_PX = 1123;

interface ReportPreviewProps {
  testData: TestData;
  config: ReportConfig;
  onBack: () => void;
}

export const ReportPreview = ({ testData, config, onBack }: ReportPreviewProps) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Calculate total pages from content height
  useEffect(() => {
    const measure = () => {
      const el = contentRef.current;
      if (el) {
        const pages = Math.max(1, Math.ceil(el.scrollHeight / A4_HEIGHT_PX));
        setTotalPages(pages);
      }
    };
    measure();
    // Re-measure on window resize
    window.addEventListener('resize', measure);
    // Also measure after a short delay for charts to render
    const timer = setTimeout(measure, 2000);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, [testData, config]);

  // Track scroll position to update current page
  const handleScroll = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    // Account for the 0.7 scale transform
    const scaledPageHeight = A4_HEIGHT_PX * 0.7;
    const page = Math.floor(scrollEl.scrollTop / scaledPageHeight) + 1;
    setCurrentPage(Math.min(page, totalPages));
  }, [totalPages]);

  const scrollToPage = (page: number) => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const scaledPageHeight = A4_HEIGHT_PX * 0.7;
    scrollEl.scrollTo({ top: (page - 1) * scaledPageHeight, behavior: 'smooth' });
  };

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    setPdfError(null);
    setGenerationProgress(0);
    try {
      await generatePDF(testData, config, (progress) => {
        setGenerationProgress(Math.round(progress));
      });
    } catch (error) {
      setPdfError('Failed to generate PDF. Please try again.');
      console.error('PDF Generation Error:', error);
    } finally {
      setIsGeneratingPDF(false);
      setGenerationProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
        <button
          onClick={onBack}
          className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Configuration
        </button>
        <div className="flex items-center gap-4">
          {/* Page navigation */}
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <button
              onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronUpIcon className="w-4 h-4" />
            </button>
            <span className="min-w-[80px] text-center font-medium">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronDownIcon className="w-4 h-4" />
            </button>
          </div>

          {pdfError && <span className="text-red-600 text-sm">{pdfError}</span>}
          {isGeneratingPDF && (
            <div className="flex items-center">
              <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">{generationProgress}%</span>
            </div>
          )}
          <button
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF}
            className={`flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors ${
              isGeneratingPDF ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            {isGeneratingPDF ? (
              <>
                <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <DownloadIcon className="w-4 h-4 mr-2" />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Frame - scrollable, shows all pages with page break indicators */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-gray-200 rounded-lg shadow-inner p-8 flex justify-center"
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
        data-testid="preview-container"
      >
        <div
          className="shadow-2xl ring-1 ring-black/5"
          style={{
            transform: 'scale(0.7)',
            transformOrigin: 'top center',
            marginBottom: '-30%',
            borderRadius: '4px',
            overflow: 'visible',
            position: 'relative',
          }}
        >
          <div ref={contentRef}>
            <PDFPreviewFrame testData={testData} config={config} />
          </div>
          {/* Page break indicators */}
          {Array.from({ length: totalPages - 1 }, (_, i) => (
            <div
              key={`page-break-${i}`}
              style={{
                position: 'absolute',
                top: `${(i + 1) * A4_HEIGHT_PX}px`,
                left: '-20px',
                right: '-20px',
                height: '0',
                borderTop: '2px dashed #94a3b8',
                zIndex: 10,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  right: '0',
                  top: '-10px',
                  background: '#64748b',
                  color: 'white',
                  fontSize: '10px',
                  padding: '1px 8px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                Page {i + 2}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
