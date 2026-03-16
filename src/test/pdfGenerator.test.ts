import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { TestData, ReportConfig } from '../types';

/* ── Shared mock state ──────────────────────────────────────────────
 * We store the mock canvas / pdf-instance in a plain object on globalThis
 * so both the vi.mock factory (hoisted) and the tests can share state.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (!g.__pdfMocks) {
  g.__pdfMocks = {
    canvasCtx: { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() },
    canvas: {
      width: 1588,
      height: 2246,
      getContext: vi.fn(),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mock'),
    },
    pageCanvas: {
      width: 0, height: 0,
      getContext: vi.fn(),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,pageSlice'),
    },
    html2canvas: vi.fn(),
    pdf: { addPage: vi.fn(), addImage: vi.fn(), save: vi.fn() },
    JsPDF: vi.fn(),
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const __mocks: Record<string, any> = g.__pdfMocks;

// Wire up cross-refs
__mocks.canvas.getContext.mockReturnValue(__mocks.canvasCtx);
__mocks.pageCanvas.getContext.mockReturnValue(__mocks.canvasCtx);
__mocks.html2canvas.mockResolvedValue(__mocks.canvas);
__mocks.JsPDF.mockImplementation(() => __mocks.pdf);

vi.mock('html2canvas', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (globalThis as any).__pdfMocks.html2canvas,
}));
vi.mock('jspdf', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsPDF: (globalThis as any).__pdfMocks.JsPDF,
}));

describe('pdfGenerator', () => {
  let mockTestData: TestData;
  let mockConfig: ReportConfig;
  let reportEl: HTMLDivElement;

  // Stub only canvas creation – everything else stays real DOM
  const realCreateElement = document.createElement.bind(document);
  const stubbedCreateElement = (tag: string) => {
    if (tag === 'canvas') return __mocks.pageCanvas as unknown as HTMLCanvasElement;
    return realCreateElement(tag);
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-wire after clearAllMocks
    __mocks.canvas.getContext.mockReturnValue(__mocks.canvasCtx);
    __mocks.pageCanvas.getContext.mockReturnValue(__mocks.canvasCtx);
    __mocks.html2canvas.mockResolvedValue(__mocks.canvas);
    __mocks.JsPDF.mockImplementation(() => __mocks.pdf);
    __mocks.canvas.toDataURL.mockReturnValue('data:image/jpeg;base64,mock');
    __mocks.pageCanvas.toDataURL.mockReturnValue('data:image/jpeg;base64,pageSlice');
    __mocks.canvas.height = 2246;

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

    // Real DOM element for #report-preview
    reportEl = document.createElement('div');
    reportEl.id = 'report-preview';
    reportEl.innerHTML = '<div>Report content</div>';
    document.body.appendChild(reportEl);

    // Chart-render-complete indicator
    const indicator = document.createElement('div');
    indicator.className = 'chart-render-complete';
    document.body.appendChild(indicator);

    // Stub createElement for canvas slicing
    vi.spyOn(document, 'createElement')
      .mockImplementation(stubbedCreateElement as typeof document.createElement);

    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => { cb(0); return 0; });
  });

  afterEach(() => {
    document.getElementById('report-preview')?.remove();
    document.querySelector('.chart-render-complete')?.remove();
    vi.restoreAllMocks();
  });

  it('should export generatePDF function', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    expect(typeof generatePDF).toBe('function');
  });

  it('should generate PDF successfully', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await expect(generatePDF(mockTestData, mockConfig)).resolves.not.toThrow();
  });

  it('should call progress callback', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    const cb = vi.fn();
    await generatePDF(mockTestData, mockConfig, cb);
    expect(cb).toHaveBeenCalledWith(100);
  });

  it('should throw when report element not found', async () => {
    reportEl.remove();
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow('No report content found');
  });

  it('should call html2canvas with correct options', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(__mocks.html2canvas).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scale: 2, width: 794, windowWidth: 794, x: 0, y: 0, backgroundColor: '#ffffff',
      }),
    );
  });

  it('should create jsPDF with A4 portrait settings', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(__mocks.JsPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: 'mm', format: 'a4', orientation: 'portrait', compress: true,
      }),
    );
  });

  it('should save PDF with date-stamped filename', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(__mocks.pdf.save).toHaveBeenCalledWith(
      expect.stringMatching(/test-results-report-\d{4}-\d{2}-\d{2}\.pdf/),
    );
  });

  it('should add images to PDF for each page', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(__mocks.pdf.addImage).toHaveBeenCalled();
    expect(__mocks.pdf.addImage).toHaveBeenCalledWith(
      expect.stringContaining('data:image'), 'JPEG', 0, 0, 210, expect.any(Number),
    );
  });

  it('should handle multi-page content', async () => {
    __mocks.canvas.height = 2246 * 3;
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await generatePDF(mockTestData, mockConfig);
    expect(__mocks.pdf.addPage).toHaveBeenCalledTimes(2);
    expect(__mocks.pdf.addImage).toHaveBeenCalledTimes(3);
  });

  it('should clean up offscreen clone after generation', async () => {
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    const childrenBefore = document.body.children.length;
    await generatePDF(mockTestData, mockConfig);
    expect(document.body.children.length).toBe(childrenBefore);
  });

  it('should handle timeout error', async () => {
    __mocks.html2canvas.mockRejectedValueOnce(new Error('timeout'));
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/timed out/);
  });

  it('should handle memory error', async () => {
    __mocks.html2canvas.mockRejectedValueOnce(new Error('Maximum call stack'));
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/Not enough memory/);
  });

  it('should handle unknown error', async () => {
    __mocks.html2canvas.mockRejectedValueOnce('String error');
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/unknown error/);
  });

  it('should handle generic Error', async () => {
    __mocks.html2canvas.mockRejectedValueOnce(new Error('Something else'));
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');
    await expect(generatePDF(mockTestData, mockConfig)).rejects.toThrow(/Failed to generate PDF: Something else/);
  });

  it('should validate config structure', () => {
    expect(mockConfig).toHaveProperty('title');
    expect(mockConfig).toHaveProperty('author');
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
});
