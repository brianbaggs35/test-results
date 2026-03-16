import { useState } from 'react';
import { ArrowLeftIcon, DownloadIcon, LoaderIcon } from 'lucide-react';
import { generatePDF } from './pdfGenerator';
import { PDFPreviewFrame } from './PDFPreviewFrame';
import { TestData, ReportConfig } from '../../types';

interface ReportPreviewProps {
  testData: TestData;
  config: ReportConfig;
  onBack: () => void;
}

export const ReportPreview = ({ testData, config, onBack }: ReportPreviewProps) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);

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

      {/* Preview Frame - contained, scrollable, shows A4-sized content */}
      <div
        className="bg-gray-200 rounded-lg shadow-inner p-8 flex justify-center"
        style={{ maxHeight: '78vh', overflowY: 'auto' }}
        data-testid="preview-container"
      >
        <div
          className="shadow-2xl ring-1 ring-black/5"
          style={{
            transform: 'scale(0.82)',
            transformOrigin: 'top center',
            marginBottom: '-18%',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <PDFPreviewFrame testData={testData} config={config} />
        </div>
      </div>
    </div>
  );
};
