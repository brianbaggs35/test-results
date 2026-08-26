import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeftIcon, DownloadIcon, LoaderIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react';
import { generatePDF } from './pdfGenerator';
import { PDFPreviewFrame } from './PDFPreviewFrame';
import { TestData, ReportConfig } from '../../types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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
  const [scaledContentHeight, setScaledContentHeight] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Calculate total pages, and the visual (post-scale) height to reserve for scrolling, from
  // the content's real height
  useEffect(() => {
    const measure = () => {
      const el = contentRef.current;
      if (el) {
        const pages = Math.max(1, Math.ceil(el.scrollHeight / A4_HEIGHT_PX));
        setTotalPages(pages);
        setScaledContentHeight(el.scrollHeight * 0.7);
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
      <div className="flex justify-between items-center bg-card border rounded-lg shadow-xs p-4">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeftIcon className="size-4" />
          Back to Configuration
        </Button>
        <div className="flex items-center gap-4">
          {/* Page navigation */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="size-7"
            >
              <ChevronUpIcon className="size-4" />
            </Button>
            <span className="min-w-[80px] text-center font-medium text-foreground">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className="size-7"
            >
              <ChevronDownIcon className="size-4" />
            </Button>
          </div>

          {pdfError && <span className="text-destructive text-sm">{pdfError}</span>}
          {isGeneratingPDF && (
            <div className="flex items-center gap-2">
              <Progress value={generationProgress} className="w-32 [&>div]:bg-success" />
              <span className="text-sm text-muted-foreground">{generationProgress}%</span>
            </div>
          )}
          <Button onClick={handleGeneratePDF} disabled={isGeneratingPDF} className="bg-success text-success-foreground hover:bg-success/90">
            {isGeneratingPDF ? (
              <>
                <LoaderIcon className="size-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <DownloadIcon className="size-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preview Frame - scrollable, shows all pages with page break indicators */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-muted rounded-lg shadow-inner p-8 flex justify-center"
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
        data-testid="preview-container"
      >
        <div
          style={{
            // A little taller than the scaled content itself so shadow-2xl's blur isn't
            // clipped at the bottom edge; the page-scroll math below is keyed off a fixed
            // per-page height, not this wrapper's total height, so the buffer doesn't skew it.
            height: scaledContentHeight != null ? scaledContentHeight + 40 : undefined,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            className="shadow-2xl ring-1 ring-black/5"
            style={{
              transform: 'scale(0.7)',
              transformOrigin: 'top center',
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
    </div>
  );
};
