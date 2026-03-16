import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestData, ReportConfig } from '../types';

interface MockHtml2PdfWorker {
  from: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}

interface MockDocument extends Document {
  getElementById: ReturnType<typeof vi.fn>;
  querySelector: ReturnType<typeof vi.fn>;
  querySelectorAll: ReturnType<typeof vi.fn>;
  createElement: ReturnType<typeof vi.fn>;
}

const mockHtml2PdfWorker: MockHtml2PdfWorker = {
  from: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  save: vi.fn().mockResolvedValue(undefined),
};

const mockHtml2Pdf = vi.fn(() => mockHtml2PdfWorker);

Object.defineProperty(global, 'window', {
  value: { html2pdf: mockHtml2Pdf },
  writable: true,
});

Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn().mockReturnValue({
      style: {}, innerHTML: '', textContent: '',
      querySelector: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
      getElementsByTagName: vi.fn().mockReturnValue([]),
      remove: vi.fn(), appendChild: vi.fn(), insertBefore: vi.fn(),
    }),
    getElementById: vi.fn().mockImplementation((id: string) => {
      if (id === 'report-preview') {
        return {
          style: {}, innerHTML: '<div>Mock content</div>',
          parentElement: null,
          querySelectorAll: vi.fn().mockReturnValue([]),
          querySelector: vi.fn(),
          getElementsByTagName: vi.fn().mockReturnValue([]),
          insertBefore: vi.fn(),
        };
      }
      return null;
    }),
    querySelector: vi.fn().mockReturnValue(null),
    querySelectorAll: vi.fn().mockReturnValue([]),
    head: { appendChild: vi.fn() },
  },
  writable: true,
});

describe('pdfGenerator', () => {
  let mockTestData: TestData;
  let mockConfig: ReportConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHtml2PdfWorker.from.mockReturnThis();
    mockHtml2PdfWorker.set.mockReturnThis();
    mockHtml2PdfWorker.save.mockResolvedValue(undefined);

    mockTestData = {
      summary: { total: 100, passed: 75, failed: 20, skipped: 5, time: 120.5 },
      suites: [{
        name: 'Suite 1', tests: 50, failures: 10, errors: 0, skipped: 2,
        time: 60.0, timestamp: '2024-01-01T12:00:00Z',
        testcases: Array.from({ length: 50 }, (_, i) => ({
          name: `Test ${i + 1}`,
          status: i < 37 ? 'passed' : i < 47 ? 'failed' : 'skipped',
          suite: 'Suite 1', time: Math.random() * 5,
        })),
      }],
    };

    mockConfig = {
      title: 'Test Results Report', author: 'Test Author', projectName: 'Test Project',
      includeExecutiveSummary: true, includeTestMetrics: true,
      includeFailedTests: true, includeAllTests: true, includeResolutionProgress: true,
    };

    window.html2pdf = mockHtml2Pdf;

    document.createElement = vi.fn().mockReturnValue({
      style: {}, innerHTML: '', textContent: '',
      querySelector: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
      getElementsByTagName: vi.fn().mockReturnValue([]),
      remove: vi.fn(), appendChild: vi.fn(), insertBefore: vi.fn(),
    });

    document.getElementById = vi.fn().mockImplementation((id: string) => {
      if (id === 'report-preview') {
        return {
          style: {}, innerHTML: '<div>Mock</div>',
          parentElement: null,
          querySelectorAll: vi.fn().mockReturnValue([]),
          querySelector: vi.fn(),
          getElementsByTagName: vi.fn().mockReturnValue([]),
          insertBefore: vi.fn(),
        };
      }
      return null;
    });

    document.querySelector = vi.fn().mockImplementation((sel: string) => {
      if (sel === '.chart-render-complete') return { classList: { contains: vi.fn().mockReturnValue(true) } };
      return null;
    });
    document.querySelectorAll = vi.fn().mockReturnValue([]);
  });

  afterEach(() => { vi.resetAllMocks(); });

  it('should export generatePDF function', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    expect(typeof generatePDF).toBe('function');
  });

  it('should generate PDF successfully', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await expect(generatePDF(mockTestData, mockConfig)).resolves.not.toThrow();
    expect(mockHtml2Pdf).toHaveBeenCalled();
    expect(mockHtml2PdfWorker.from).toHaveBeenCalled();
    expect(mockHtml2PdfWorker.set).toHaveBeenCalled();
    expect(mockHtml2PdfWorker.save).toHaveBeenCalled();
  });

  it('should call progress callback', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    const cb = vi.fn();
    await generatePDF(mockTestData, mockConfig, cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Number));
  });

  it('should throw when report element not found', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    document.getElementById = vi.fn().mockReturnValue(null);
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow('No report content found for PDF generation');
  });

  it('should use portrait A4 orientation', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        jsPDF: expect.objectContaining({
          unit: 'mm', format: 'a4', orientation: 'portrait', compress: true,
        }),
      })
    );
  });

  it('should generate correct filename with date', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(/test-results-report-\d{4}-\d{2}-\d{2}\.pdf/),
      })
    );
  });

  it('should use 10mm margins', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({ margin: [10, 10, 10, 10] })
    );
  });

  it('should set windowWidth to 794 (A4 at 96 DPI)', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        html2canvas: expect.objectContaining({ windowWidth: 794, scale: 2 }),
      })
    );
  });

  it('should configure page breaks', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        pagebreak: expect.objectContaining({
          mode: ['css', 'legacy'],
          before: '.page-break-before',
          after: '.page-break-after',
          avoid: ['.avoid-break', 'h1', 'h2', 'h3'],
        }),
      })
    );
  });

  it('should handle timeout error', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    mockHtml2PdfWorker.save.mockRejectedValue(new Error('PDF generation timed out'));
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/timed out/);
  });

  it('should handle memory error', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    mockHtml2PdfWorker.save.mockRejectedValue(new Error('Maximum call stack size exceeded'));
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/Not enough memory/);
  });

  it('should handle unknown error', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    mockHtml2PdfWorker.save.mockRejectedValue('String error');
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/unknown error/);
  });

  it('should handle generic Error', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    mockHtml2PdfWorker.save.mockRejectedValue(new Error('Something else'));
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/Failed to generate PDF: Something else/);
  });

  it('should use JPEG image format', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(mockHtml2PdfWorker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.objectContaining({ type: 'jpeg', quality: 0.98 }),
      })
    );
  });

  it('should handle HTML2PDF library loading', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    (window as { html2pdf?: unknown }).html2pdf = undefined;

    const mockScript: { src: string; onload: (() => void) | null; onerror: (() => void) | null } = {
      src: '', onload: null, onerror: null,
    };
    document.createElement = vi.fn().mockReturnValue(mockScript);

    setTimeout(() => {
      if (mockScript.onload) {
        window.html2pdf = mockHtml2Pdf;
        mockScript.onload();
      }
    }, 0);

    await generatePDF(mockTestData, mockConfig);
    expect(document.createElement).toHaveBeenCalledWith('script');
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
    expect(mockTestData.summary).toHaveProperty('total');
    expect(mockTestData.summary).toHaveProperty('passed');
    expect(mockTestData.summary).toHaveProperty('failed');
    expect(mockTestData.summary).toHaveProperty('skipped');
    expect(mockTestData.summary).toHaveProperty('time');
    expect(Array.isArray(mockTestData.suites)).toBe(true);
  });

  it('should handle chart render complete', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await expect(generatePDF(mockTestData, mockConfig)).resolves.not.toThrow();
  });

  it('should handle large tables via onclone', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    let onclone: ((doc: Document) => void) | undefined;
    mockHtml2PdfWorker.set.mockImplementation((opts: { html2canvas?: { onclone?: (doc: Document) => void } }) => {
      if (opts.html2canvas?.onclone) onclone = opts.html2canvas.onclone;
      return mockHtml2PdfWorker;
    });

    await generatePDF(mockTestData, mockConfig);

    const mockRows = Array.from({ length: 35 }, () => ({ style: {} }));
    const mockTable = { querySelectorAll: vi.fn().mockReturnValue(mockRows) };
    const mockContent = {
      style: {} as Record<string, string>,
      parentElement: null,
      querySelectorAll: vi.fn().mockImplementation((sel: string) => {
        if (sel === 'table') return [mockTable];
        return [];
      }),
      insertBefore: vi.fn(),
    };
    const mockDoc = {
      getElementById: vi.fn().mockReturnValue(mockContent),
      getElementsByTagName: vi.fn().mockReturnValue([]),
      createElement: vi.fn().mockReturnValue({ textContent: '' }),
      body: {},
    } as unknown as Document;

    if (onclone) onclone(mockDoc);
    expect(mockDoc.getElementById).toHaveBeenCalledWith('report-preview');
  });

  it('should handle onclone callback and neutralise ancestor transforms', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    let onclone: ((doc: Document) => void) | undefined;
    mockHtml2PdfWorker.set.mockImplementation((opts: { html2canvas?: { onclone?: (doc: Document) => void } }) => {
      if (opts.html2canvas?.onclone) onclone = opts.html2canvas.onclone;
      return mockHtml2PdfWorker;
    });

    await generatePDF(mockTestData, mockConfig);

    const grandparent = { style: { transform: 'none', webkitTransform: '', overflow: '', maxHeight: '' }, parentElement: null };
    const parentEl = { style: { transform: 'scale(0.82)', webkitTransform: '', overflow: 'hidden', maxHeight: '78vh' }, parentElement: grandparent };
    const mockContent = {
      style: {} as Record<string, string>,
      parentElement: parentEl,
      querySelectorAll: vi.fn().mockReturnValue([]),
      insertBefore: vi.fn(),
    };
    const mockBody = {};
    const mockDoc = {
      getElementById: vi.fn().mockReturnValue(mockContent),
      getElementsByTagName: vi.fn().mockReturnValue([]),
      createElement: vi.fn().mockReturnValue({ textContent: '' }),
      body: mockBody,
    } as unknown as Document;

    if (onclone) onclone(mockDoc);
    expect(parentEl.style.transform).toBe('none');
    expect(parentEl.style.overflow).toBe('visible');
    expect(mockContent.style.width).toBe('794px');
    expect(mockContent.style.padding).toBe('0');
  });

  it('should handle library loading when not available', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    const original = window.html2pdf;
    delete (window as unknown as Record<string, unknown>).html2pdf;

    const mockScript: { src: string; onload: (() => void) | null; onerror: (() => void) | null } = {
      src: '', onload: null, onerror: null,
    };
    (document.createElement as MockDocument['createElement']).mockImplementation((tag: string) => {
      if (tag === 'script') return mockScript;
      return { style: {}, innerHTML: '', querySelectorAll: vi.fn().mockReturnValue([]),
        getElementsByTagName: vi.fn().mockReturnValue([]),
        insertBefore: vi.fn(), remove: vi.fn(), appendChild: vi.fn() };
    });

    const mockHead = {
      appendChild: vi.fn().mockImplementation(() => {
        if (mockScript.onload) {
          setTimeout(() => { window.html2pdf = mockHtml2Pdf; mockScript.onload!(); }, 0);
        }
      }),
    };
    Object.defineProperty(document, 'head', { value: mockHead, configurable: true });

    try {
      await generatePDF(mockTestData, mockConfig);
      expect(mockHead.appendChild).toHaveBeenCalled();
    } finally {
      window.html2pdf = original;
    }
  });
});
