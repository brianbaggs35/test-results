import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generatePDF } from '../components/ReportGenerator/pdfGenerator';
import { TestData, ReportConfig } from '../types';

// Mock window.html2pdf
const mockHtml2Pdf = vi.fn();
const mockWorker = {
  from: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  save: vi.fn().mockResolvedValue(undefined)
};

// Set up window.html2pdf mock
vi.stubGlobal('html2pdf', mockHtml2Pdf.mockReturnValue(mockWorker));

describe('pdfGenerator', () => {
  let mockTestData: TestData;
  let mockConfig: ReportConfig;
  let mockProgress: (progress: number) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Properly set up the html2pdf mock
    vi.stubGlobal('html2pdf', mockHtml2Pdf.mockReturnValue(mockWorker));
    
    mockTestData = {
      summary: {
        total: 100,
        passed: 75,
        failed: 20,
        skipped: 5,
        time: 120.5
      },
      suites: [
        {
          name: 'Suite 1',
          tests: 50,
          failures: 10,
          errors: 0,
          skipped: 2,
          time: 60.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: Array.from({ length: 50 }, (_, index) => ({
            name: `Test ${index + 1}`,
            status: index < 37 ? 'passed' : index < 47 ? 'failed' : 'skipped',
            suite: 'Suite 1',
            time: Math.random() * 5
          }))
        }
      ]
    };

    mockConfig = {
      title: 'Test Results Report',
      author: 'Test Author',
      projectName: 'Test Project',
      includeExecutiveSummary: true,
      includeTestMetrics: true,
      includeFailedTests: true,
      includeAllTests: true,
      includeResolutionProgress: true
    };

    mockProgress = vi.fn();

    // Create comprehensive mock element
    const createMockElement = () => ({
      cloneNode: vi.fn().mockReturnValue({
        querySelectorAll: vi.fn().mockReturnValue([]),
        insertBefore: vi.fn(),
        innerHTML: '<div>test content</div>',
        style: {}
      }),
      style: {},
      parentElement: {
        style: {}
      },
      insertBefore: vi.fn(),
      textContent: '',
      src: '',
      onload: null,
      onerror: null
    });

    // Mock getElementById
    document.getElementById = vi.fn().mockImplementation((id: string) => {
      if (id === 'pdf-preview-frame' || id === 'report-preview') {
        return createMockElement();
      }
      return null;
    });

    // Mock createElement
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      const element = createMockElement();
      if (tagName === 'style') {
        return {
          ...element,
          textContent: ''
        };
      }
      return element;
    });

    // Mock document.head.appendChild
    document.head.appendChild = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate PDF successfully with normal dataset', async () => {
    await generatePDF(mockTestData, mockConfig, mockProgress);

    expect(mockHtml2Pdf).toHaveBeenCalled();
    expect(mockWorker.from).toHaveBeenCalled();
    expect(mockWorker.set).toHaveBeenCalled();
    expect(mockWorker.save).toHaveBeenCalled();
    expect(mockProgress).toHaveBeenCalledWith(100);
  });

  it('should call progress callback at expected intervals', async () => {
    await generatePDF(mockTestData, mockConfig, mockProgress);

    expect(mockProgress).toHaveBeenCalledWith(10);
    expect(mockProgress).toHaveBeenCalledWith(20);
    expect(mockProgress).toHaveBeenCalledWith(30);
    expect(mockProgress).toHaveBeenCalledWith(40);
    expect(mockProgress).toHaveBeenCalledWith(60);
    expect(mockProgress).toHaveBeenCalledWith(100);
  });

  it('should work without progress callback', async () => {
    await expect(generatePDF(mockTestData, mockConfig)).resolves.not.toThrow();
  });

  it('should use conservative settings for large datasets', async () => {
    const largeTestData = {
      ...mockTestData,
      summary: {
        ...mockTestData.summary,
        total: 3000
      }
    };

    await generatePDF(largeTestData, mockConfig, mockProgress);

    expect(mockWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        html2canvas: expect.objectContaining({
          scale: 1.2,
          windowWidth: 1000,
          windowHeight: 1414
        })
      })
    );
  });

  it('should fallback to regular preview if PDF frame not found', async () => {
    document.getElementById = vi.fn().mockImplementation((id: string) => {
      if (id === 'pdf-preview-frame') {
        return null;
      }
      if (id === 'report-preview') {
        return {
          cloneNode: vi.fn().mockReturnValue({
            querySelectorAll: vi.fn().mockReturnValue([]),
            insertBefore: vi.fn(),
            innerHTML: '<div>regular preview content</div>',
            style: {}
          }),
          style: {}
        };
      }
      return null;
    });

    await generatePDF(mockTestData, mockConfig, mockProgress);

    expect(mockWorker.from).toHaveBeenCalled();
    expect(mockWorker.save).toHaveBeenCalled();
  });

  it('should throw error if no report content found', async () => {
    document.getElementById = vi.fn().mockReturnValue(null);

    await expect(generatePDF(mockTestData, mockConfig, mockProgress))
      .rejects.toThrow('No report content found for PDF generation');
  });

  it('should handle html2pdf timeout error', async () => {
    mockWorker.save.mockRejectedValue(new Error('PDF generation timed out'));

    await expect(generatePDF(mockTestData, mockConfig, mockProgress))
      .rejects.toThrow(/PDF generation timed out.*contains 100 tests/);
  });

  it('should handle memory error', async () => {
    mockWorker.save.mockRejectedValue(new Error('Maximum call stack size exceeded'));

    await expect(generatePDF(mockTestData, mockConfig, mockProgress))
      .rejects.toThrow(/Not enough memory.*100 tests/);
  });

  it('should handle generic errors', async () => {
    mockWorker.save.mockRejectedValue(new Error('Unknown error'));

    await expect(generatePDF(mockTestData, mockConfig, mockProgress))
      .rejects.toThrow(/Failed to generate PDF: Unknown error/);
  });

  it('should handle non-Error objects', async () => {
    mockWorker.save.mockRejectedValue('String error');

    await expect(generatePDF(mockTestData, mockConfig, mockProgress))
      .rejects.toThrow('Failed to generate PDF due to an unknown error');
  });

  it('should configure PDF options correctly', async () => {
    await generatePDF(mockTestData, mockConfig, mockProgress);

    expect(mockWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        margin: [10, 10, 10, 10],
        filename: expect.stringMatching(/test-results-report-\d{4}-\d{2}-\d{2}\.pdf/),
        image: {
          type: 'jpeg',
          quality: 0.9
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
          compress: true,
          putOnlyUsedFonts: true,
          floatPrecision: 8
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          before: '.page-break-before',
          after: '.page-break-after',
          avoid: ['.avoid-break', 'h1', 'h2', 'h3']
        }
      })
    );
  });
});