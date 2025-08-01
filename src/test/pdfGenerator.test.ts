import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestData, ReportConfig } from '../types';

// Type definitions for window extensions and mock objects  
interface WindowWithExtensions extends Window {
  html2pdf: (() => MockHtml2PdfWorker) & MockHtml2PdfApi;
  vi?: unknown;
}

interface MockHtml2PdfWorker {
  from: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}

interface MockHtml2PdfApi {
  (): MockHtml2PdfWorker;
}

interface MockDocument extends Document {
  getElementById: ReturnType<typeof vi.fn>;
  querySelector: ReturnType<typeof vi.fn>;
  querySelectorAll: ReturnType<typeof vi.fn>;
  createElement: ReturnType<typeof vi.fn>;
}

interface Html2PdfOptions {
  margin?: number[];
  filename?: string;
  image?: Record<string, unknown>;
  html2canvas?: Record<string, unknown>;
  jsPDF?: Record<string, unknown>;
  pagebreak?: Record<string, unknown>;
  autoPaging?: string;
  onclone?: (doc: Document) => void;
}

// Mock window.html2pdf
const mockHtml2PdfWorker: MockHtml2PdfWorker = {
  from: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  save: vi.fn().mockResolvedValue(undefined)
};

const mockHtml2Pdf = vi.fn(() => mockHtml2PdfWorker) as MockHtml2PdfApi;

// Global window mock setup
Object.defineProperty(global, 'window', {
  value: {
    html2pdf: mockHtml2Pdf
  },
  writable: true
});

// Mock document for HTML parsing
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn().mockReturnValue({
      style: {},
      innerHTML: '',
      textContent: '',
      querySelector: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
      getElementsByTagName: vi.fn().mockReturnValue([]),
      remove: vi.fn(),
      appendChild: vi.fn(),
      insertBefore: vi.fn()
    }),
    getElementById: vi.fn().mockImplementation((id: string) => {
      if (id === 'report-preview') {
        return {
          cloneNode: vi.fn().mockReturnValue({
            querySelectorAll: vi.fn().mockReturnValue([]),
            querySelector: vi.fn(),
            getElementsByTagName: vi.fn().mockReturnValue([]),
            insertBefore: vi.fn(),
            innerHTML: '<div>Mock content</div>',
            style: {}
          }),
          querySelector: vi.fn(),
          querySelectorAll: vi.fn().mockReturnValue([]),
          style: {},
          innerHTML: '<div>Mock content</div>'
        };
      }
      return null;
    }),
    querySelector: vi.fn().mockReturnValue(null),
    querySelectorAll: vi.fn().mockReturnValue([]),
    head: {
      appendChild: vi.fn()
    }
  },
  writable: true
});

describe('pdfGenerator', () => {
  let mockTestData: TestData;
  let mockConfig: ReportConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mocks
    mockHtml2PdfWorker.from.mockReturnThis();
    mockHtml2PdfWorker.set.mockReturnThis();
    mockHtml2PdfWorker.save.mockResolvedValue(undefined);
    
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

    // Reset window.html2pdf mock
    window.html2pdf = mockHtml2Pdf;

    // Reset document mocks
    document.createElement = vi.fn().mockReturnValue({
      style: {},
      innerHTML: '',
      textContent: '',
      querySelector: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
      getElementsByTagName: vi.fn().mockReturnValue([]),
      remove: vi.fn(),
      appendChild: vi.fn(),
      insertBefore: vi.fn()
    });

    // Reset document.getElementById mock to return report-preview element
    document.getElementById = vi.fn().mockImplementation((id: string) => {
      if (id === 'report-preview') {
        return {
          cloneNode: vi.fn().mockReturnValue({
            querySelectorAll: vi.fn().mockReturnValue([]),
            querySelector: vi.fn(),
            getElementsByTagName: vi.fn().mockReturnValue([]),
            insertBefore: vi.fn(),
            innerHTML: '<div>Mock content</div>',
            style: {}
          }),
          querySelector: vi.fn(),
          querySelectorAll: vi.fn().mockReturnValue([]),
          style: {},
          innerHTML: '<div>Mock content</div>'
        };
      }
      return null;
    });

    // Reset document.querySelector mock to return chart render complete element
    document.querySelector = vi.fn().mockImplementation((selector: string) => {
      if (selector === '.chart-render-complete') {
        return { classList: { contains: vi.fn().mockReturnValue(true) } };
      }
      return null;
    });
    document.querySelectorAll = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should export generatePDF function', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    expect(typeof generatePDF).toBe('function');
  });

  it('should successfully generate PDF with valid data', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    await expect(generatePDF(mockTestData, mockConfig)).resolves.not.toThrow();
    
    expect(mockHtml2Pdf).toHaveBeenCalled();
    expect(mockHtml2PdfWorker.from).toHaveBeenCalled();
    expect(mockHtml2PdfWorker.set).toHaveBeenCalled();
    expect(mockHtml2PdfWorker.save).toHaveBeenCalled();
  });

  it('should call progress callback if provided', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    const progressCallback = vi.fn();
    
    await generatePDF(mockTestData, mockConfig, progressCallback);
    
    expect(progressCallback).toHaveBeenCalledWith(expect.any(Number));
  });

  it('should throw error if report preview element not found', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock getElementById to return null for report-preview
    const originalGetElementById = document.getElementById;
    document.getElementById = vi.fn().mockReturnValue(null);
    
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow('No report content found for PDF generation');
    
    // Restore original mock
    document.getElementById = originalGetElementById;
  });

  it('should handle HTML2PDF library loading', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Test when html2pdf is not available initially
    (window as { html2pdf?: unknown }).html2pdf = undefined;
    
    // Mock script creation and loading
    const mockScript = {
      src: '',
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null
    };
    
    document.createElement = vi.fn().mockReturnValue(mockScript);
    
    // Simulate successful script loading
    setTimeout(() => {
      if (mockScript.onload) {
        window.html2pdf = mockHtml2Pdf;
        mockScript.onload();
      }
    }, 0);
    
    await generatePDF(mockTestData, mockConfig);
    
    expect(document.createElement).toHaveBeenCalledWith('script');
  });

  it('should optimize settings for very large datasets', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Create a very large dataset
    const largeTestData: TestData = {
      summary: {
        total: 5000,
        passed: 4000,
        failed: 900,
        skipped: 100,
        time: 3600
      },
      suites: [{
        name: 'Large Suite',
        tests: 5000,
        failures: 900,
        errors: 0,
        skipped: 100,
        time: 3600,
        timestamp: '2024-01-01T12:00:00Z',
        testcases: Array.from({ length: 5000 }, (_, index) => ({
          name: `Test ${index + 1}`,
          status: index < 4000 ? 'passed' : index < 4900 ? 'failed' : 'skipped',
          suite: 'Large Suite',
          time: Math.random() * 5
        }))
      }]
    };
    
    await generatePDF(largeTestData, mockConfig);
    
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        html2canvas: expect.objectContaining({
          scale: expect.any(Number),
          windowWidth: expect.any(Number),
          windowHeight: expect.any(Number)
        })
      })
    );
  });

  it('should handle chart render complete in test environment', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Simply test that PDF generation works in test environment
    // The vitest flag is already set in this environment
    await expect(generatePDF(mockTestData, mockConfig)).resolves.not.toThrow();
  });

  it('should generate appropriate filename', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    await generatePDF(mockTestData, mockConfig);
    
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(/test-results-report-\d{4}-\d{2}-\d{2}\.pdf/)
      })
    );
  });

  it('should handle PDF generation timeout error', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock save to reject with timeout
    mockHtml2PdfWorker.save = vi.fn().mockRejectedValue(new Error('PDF generation timed out'));
    
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/PDF generation timed out/);
  });

  it('should handle memory errors gracefully', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock save to reject with memory error
    mockHtml2PdfWorker.save = vi.fn().mockRejectedValue(new Error('Maximum call stack size exceeded'));
    
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/Not enough memory/);
  });

  it('should handle unknown errors', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock save to reject with unknown error
    mockHtml2PdfWorker.save = vi.fn().mockRejectedValue('Unknown error');
    
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/Failed to generate PDF due to an unknown error/);
  });

  it('should configure PDF options correctly', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    await generatePDF(mockTestData, mockConfig);
    
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        margin: [2, 2, 2, 2],
        autoPaging: 'text',
        image: expect.objectContaining({
          type: 'jpeg',
          quality: 0.99
        }),
        jsPDF: expect.objectContaining({
          unit: 'pt',
          format: 'a4',
          orientation: 'landscape',
          compress: true
        })
      })
    );
  });

  it('should handle medium-sized datasets with appropriate scaling', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    const mediumTestData: TestData = {
      summary: {
        total: 1000,
        passed: 800,
        failed: 150,
        skipped: 50,
        time: 600
      },
      suites: [{
        name: 'Medium Suite',
        tests: 1000,
        failures: 150,
        errors: 0,
        skipped: 50,
        time: 600,
        timestamp: '2024-01-01T12:00:00Z',
        testcases: Array.from({ length: 1000 }, (_, index) => ({
          name: `Test ${index + 1}`,
          status: index < 800 ? 'passed' : index < 950 ? 'failed' : 'skipped',
          suite: 'Medium Suite',
          time: Math.random() * 5
        }))
      }]
    };
    
    await generatePDF(mediumTestData, mockConfig);
    
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        html2canvas: expect.objectContaining({
          scale: expect.any(Number)
        })
      })
    );
  });

  it('should configure page break options correctly', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    await generatePDF(mockTestData, mockConfig);
    
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        pagebreak: expect.objectContaining({
          mode: ['css', 'legacy'],
          before: '.page-break-before',
          after: '.page-break-after',
          avoid: ['.avoid-break', 'h1', 'h2', 'h3']
        })
      })
    );
  });

  it('should validate config structure', () => {
    expect(mockConfig).toHaveProperty('title');
    expect(mockConfig).toHaveProperty('author');
    expect(mockConfig).toHaveProperty('projectName');
    expect(mockConfig).toHaveProperty('includeExecutiveSummary');
    expect(mockConfig).toHaveProperty('includeTestMetrics');
    expect(mockConfig).toHaveProperty('includeFailedTests');
    expect(mockConfig).toHaveProperty('includeAllTests');
    expect(mockConfig).toHaveProperty('includeResolutionProgress');
  });

  it('should validate test data structure', () => {
    expect(mockTestData).toHaveProperty('summary');
    expect(mockTestData).toHaveProperty('suites');
    expect(mockTestData.summary).toHaveProperty('total');
    expect(mockTestData.summary).toHaveProperty('passed');
    expect(mockTestData.summary).toHaveProperty('failed');
    expect(mockTestData.summary).toHaveProperty('skipped');
    expect(mockTestData.summary).toHaveProperty('time');
    expect(Array.isArray(mockTestData.suites)).toBe(true);
  });

  it('should handle prepareContent with large tables', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock a large table structure
    const mockElement = {
      cloneNode: vi.fn().mockReturnValue({
        querySelectorAll: vi.fn().mockImplementation((selector: string) => {
          if (selector === 'table') {
            return [{
              querySelector: vi.fn().mockReturnValue({
                querySelectorAll: vi.fn().mockReturnValue(
                  // Create array of 35 mock rows to trigger the large table logic
                  Array.from({ length: 35 }, (_, index) => ({
                    style: {},
                    textContent: `Row ${index}`
                  }))
                )
              })
            }];
          }
          if (selector.includes('.recharts-tooltip-wrapper') || 
              selector.includes('button') || 
              selector.includes('.print-hide') ||
              selector.includes('input') ||
              selector.includes('select')) {
            return [{
              remove: vi.fn()
            }];
          }
          return [];
        }),
        querySelector: vi.fn(),
        getElementsByTagName: vi.fn().mockReturnValue([]),
        insertBefore: vi.fn(),
        innerHTML: '<div>Mock content with large table</div>',
        style: {}
      }),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
      style: {},
      innerHTML: '<div>Mock content with large table</div>'
    };

    (document.getElementById as MockDocument['getElementById']).mockReturnValue(mockElement);

    await generatePDF(mockTestData, mockConfig);

    expect(mockHtml2Pdf).toHaveBeenCalled();
  });

  it('should handle chart render complete polling in non-test environment', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock window.vi to be undefined to simulate non-test environment
    const originalVi = (window as unknown as WindowWithExtensions).vi;
    delete (window as unknown as WindowWithExtensions).vi;

    // Mock querySelector to return null initially, then a chart-render-complete element
    let queryCallCount = 0;
    (document.querySelector as MockDocument['querySelector']).mockImplementation((selector: string) => {
      if (selector === '.chart-render-complete') {
        queryCallCount++;
        if (queryCallCount > 2) {
          return { textContent: 'complete' }; // Simulate finding the element after a few calls
        }
        return null;
      }
      return null;
    });

    try {
      await generatePDF(mockTestData, mockConfig);
      expect(mockHtml2Pdf).toHaveBeenCalled();
    } finally {
      // Restore original values
      if (originalVi !== undefined) {
        (window as unknown as WindowWithExtensions).vi = originalVi;
      }
    }
  });

  it('should handle onclone function with PDF frame styling', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock the onclone callback to test the PDF frame styling logic
    let oncloneCallback: ((doc: Document) => void) | undefined;
    
    mockHtml2PdfWorker.set.mockImplementation((options: Html2PdfOptions) => {
      if (options.onclone) {
        oncloneCallback = options.onclone;
      }
      return mockHtml2PdfWorker;
    });

    // Mock a document with PDF frame elements
    const mockDoc = {
      getElementById: vi.fn().mockImplementation((id: string) => {
        if (id === 'report-preview') {
          return {
            style: {},
            parentElement: {
              style: {}
            }
          };
        }
        return null;
      })
    } as unknown as Document;

    await generatePDF(mockTestData, mockConfig);

    // Execute the onclone callback if it was set
    if (oncloneCallback) {
      oncloneCallback(mockDoc);
    }

    expect(mockHtml2Pdf).toHaveBeenCalled();
  });

  it('should handle errors without specific message patterns', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock a generic error without timeout, memory, or stack overflow messages
    mockHtml2PdfWorker.save.mockRejectedValueOnce(new Error('Generic error'));

    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(
      'Failed to generate PDF: Generic error. Try reducing the report content or contact support.'
    );
  });

  it('should handle non-Error exceptions', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock a non-Error exception (like a string or object)
    mockHtml2PdfWorker.save.mockRejectedValueOnce('String error');

    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(
      'Failed to generate PDF due to an unknown error. Please try again.'
    );
  });

  it('should handle HTML2PDF library loading when not available', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    
    // Mock window without html2pdf to test the loading logic
    const originalHtml2Pdf = (window as unknown as WindowWithExtensions).html2pdf;
    delete (window as unknown as Record<string, unknown>).html2pdf;

    // Mock script loading
    const mockScript = {
      src: '',
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null
    };

    (document.createElement as MockDocument['createElement']).mockImplementation((tagName: string) => {
      if (tagName === 'script') {
        return mockScript;
      }
      return {
        style: {},
        innerHTML: '',
        textContent: '',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([]),
        getElementsByTagName: vi.fn().mockReturnValue([]),
        remove: vi.fn(),
        appendChild: vi.fn(),
        insertBefore: vi.fn()
      };
    });

    // Mock document.head.appendChild
    const mockHead = {
      appendChild: vi.fn().mockImplementation(() => {
        // Simulate successful script loading
        if (mockScript.onload) {
          setTimeout(() => {
            (window as unknown as WindowWithExtensions).html2pdf = mockHtml2Pdf;
            mockScript.onload!();
          }, 0);
        }
      })
    };

    Object.defineProperty(document, 'head', {
      value: mockHead,
      configurable: true
    });

    try {
      await generatePDF(mockTestData, mockConfig);
      expect(mockHead.appendChild).toHaveBeenCalled();
      expect(mockHtml2Pdf).toHaveBeenCalled();
    } finally {
      // Restore original html2pdf
      (window as unknown as WindowWithExtensions).html2pdf = originalHtml2Pdf;
    }
  });
});