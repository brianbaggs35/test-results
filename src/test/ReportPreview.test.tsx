import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportPreview } from '../components/ReportGenerator/ReportPreview';
import { generatePDF } from '../components/ReportGenerator/pdfGenerator';
import { TestData, ReportConfig } from '../types';

vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

vi.mock('../components/ReportGenerator/pdfGenerator', () => ({
  generatePDF: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  ArrowLeftIcon: () => <div data-testid="arrow-left-icon" />,
  DownloadIcon: () => <div data-testid="download-icon" />,
  LoaderIcon: () => <div data-testid="loader-icon" />,
  BookOpenIcon: () => <div data-testid="book-open-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />,
  XIcon: () => <div data-testid="x-icon" />,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon" />,
}));

describe('ReportPreview', () => {
  let mockTestData: TestData;
  let mockConfig: ReportConfig;

  beforeEach(() => {
    mockTestData = {
      summary: { total: 9, passed: 5, failed: 4, skipped: 0, time: 120.5 },
      suites: [
        {
          name: 'Suite A', tests: 4, failures: 2, errors: 0, skipped: 0,
          time: 60.0, timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            { name: 'test1', status: 'passed' as const, time: 0.5 },
            { name: 'test2', status: 'failed' as const, time: 0.5, errorMessage: 'First failure' },
            { name: 'test3', status: 'failed' as const, time: 0.5, errorMessage: 'Second failure' },
            { name: 'test4', status: 'passed' as const, time: 0.5 },
          ],
        },
        {
          name: 'Suite B', tests: 3, failures: 1, errors: 0, skipped: 0,
          time: 30.0, timestamp: '2024-01-01T12:01:00Z',
          testcases: [
            { name: 'test1', status: 'passed' as const, time: 0.3 },
            { name: 'test2', status: 'failed' as const, time: 0.3, errorMessage: 'Third failure' },
            { name: 'test3', status: 'passed' as const, time: 0.3 },
          ],
        },
        {
          name: 'Suite C', tests: 2, failures: 1, errors: 0, skipped: 0,
          time: 30.5, timestamp: '2024-01-01T12:02:00Z',
          testcases: [
            { name: 'test1', status: 'failed' as const, time: 0.4, errorMessage: 'Fourth failure' },
            { name: 'test2', status: 'passed' as const, time: 0.4 },
          ],
        },
      ],
    };

    mockConfig = {
      title: 'Test Report', author: 'Test Author', projectName: 'Test Project',
      includeExecutiveSummary: true, includeTestMetrics: true,
      includeFailedTests: true, includeAllTests: true, includeResolutionProgress: false,
    };
  });

  it('should render back button', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    expect(screen.getByText('Back to Configuration')).toBeInTheDocument();
  });

  it('should render download PDF button', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
  });

  it('should call onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={onBack} />);
    screen.getByText('Back to Configuration').click();
    expect(onBack).toHaveBeenCalled();
  });

  it('should render the preview container', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    expect(screen.getByTestId('preview-container')).toBeInTheDocument();
  });

  it('should render PDFPreviewFrame inside preview container', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    // The PDFPreviewFrame renders within the container
    expect(screen.getByText('Test Report')).toBeInTheDocument();
    // Project name may appear in title and executive summary body
    expect(screen.getAllByText('Test Project').length).toBeGreaterThanOrEqual(1);
  });

  it('should show preview container with max height constraint', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    const container = screen.getByTestId('preview-container');
    expect(container.style.maxHeight).toBe('78vh');
    expect(container.style.overflowY).toBe('auto');
  });

  it('should render download button as enabled initially', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    const btn = screen.getByText('Download PDF');
    expect(btn).not.toHaveAttribute('disabled');
  });

  it('should not show error message initially', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    expect(screen.queryByText(/Failed to generate PDF/)).not.toBeInTheDocument();
  });

  it('should not show progress bar initially', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('should handle test data with empty suites', () => {
    const empty = { summary: { total: 0, passed: 0, failed: 0, skipped: 0, time: 0 }, suites: [] };
    render(<ReportPreview testData={empty} config={mockConfig} onBack={() => {}} />);
    expect(screen.getByText('Back to Configuration')).toBeInTheDocument();
  });

  it('should render pie chart component via PDFPreviewFrame', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('should handle configuration with all options disabled', () => {
    const cfg = {
      ...mockConfig,
      includeExecutiveSummary: false, includeTestMetrics: false,
      includeFailedTests: false, includeAllTests: false, includeResolutionProgress: false,
    };
    render(<ReportPreview testData={mockTestData} config={cfg} onBack={() => {}} />);
    expect(screen.getByText('Back to Configuration')).toBeInTheDocument();
    expect(screen.getByText('Test Report')).toBeInTheDocument();
  });

  it('should handle configuration with resolution progress enabled', () => {
    const cfg = { ...mockConfig, includeResolutionProgress: true };
    render(<ReportPreview testData={mockTestData} config={cfg} onBack={() => {}} />);
    expect(screen.getAllByText(/Failure Resolution Progress/).length).toBeGreaterThan(0);
  });

  it('should render failed tests in the preview', () => {
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    // Failed tests appear in various sections
    const failedItems = screen.getAllByText('test2');
    expect(failedItems.length).toBeGreaterThan(0);
  });

  it('should render all test rows in all-tests section', () => {
    const { container } = render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    // Count table rows: there are multiple tables; the all-tests table has all 9 tests
    const rows = container.querySelectorAll('table tbody tr');
    // At minimum, the all-tests table should have 9 rows (total tests)
    expect(rows.length).toBeGreaterThanOrEqual(9);
  });

  it('should not produce console errors about duplicate keys', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    const keyErrors = errorSpy.mock.calls.filter(
      (call) => call.some((arg) => typeof arg === 'string' && arg.includes('same key'))
    );
    expect(keyErrors).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it('should call generatePDF and show loading state when download clicked', async () => {
    const user = userEvent.setup();
    let resolveGenerate: () => void;
    const genPromise = new Promise<void>((resolve) => { resolveGenerate = resolve; });
    vi.mocked(generatePDF).mockImplementation(async (_data, _config, onProgress) => {
      if (onProgress) onProgress(50);
      await genPromise;
    });

    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    await user.click(screen.getByText('Download PDF'));

    // Should show generating state
    await waitFor(() => {
      expect(screen.getByText('Generating PDF...')).toBeInTheDocument();
    });
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Resolve the generation
    await act(async () => { resolveGenerate!(); });

    // Should be back to normal
    await waitFor(() => {
      expect(screen.getByText('Download PDF')).toBeInTheDocument();
    });
  });

  it('should show error message when PDF generation fails', async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(generatePDF).mockRejectedValue(new Error('Generation failed'));

    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    await user.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(screen.getByText('Failed to generate PDF. Please try again.')).toBeInTheDocument();
    });

    // Should reset to Download PDF button
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('should disable download button while generating', async () => {
    const user = userEvent.setup();
    let resolveGenerate: () => void;
    vi.mocked(generatePDF).mockImplementation(async () => {
      await new Promise<void>((resolve) => { resolveGenerate = resolve; });
    });

    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    await user.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      const btn = screen.getByText('Generating PDF...').closest('button');
      expect(btn).toHaveAttribute('disabled');
    });

    await act(async () => { resolveGenerate!(); });
  });

  it('should call generatePDF with correct arguments', async () => {
    const user = userEvent.setup();
    vi.mocked(generatePDF).mockResolvedValue(undefined);

    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    await user.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(generatePDF).toHaveBeenCalledWith(mockTestData, mockConfig, expect.any(Function));
    });
  });

  it('should show progress bar during generation', async () => {
    const user = userEvent.setup();
    let progressCb: ((p: number) => void) | undefined;
    let resolveGenerate: () => void;
    vi.mocked(generatePDF).mockImplementation(async (_data, _config, onProgress) => {
      progressCb = onProgress;
      await new Promise<void>((resolve) => { resolveGenerate = resolve; });
    });

    render(<ReportPreview testData={mockTestData} config={mockConfig} onBack={() => {}} />);
    await user.click(screen.getByText('Download PDF'));

    // Manually call progress
    await act(async () => { if (progressCb) progressCb(75); });

    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    await act(async () => { resolveGenerate!(); });
  });
});
