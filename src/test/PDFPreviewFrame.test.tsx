import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PDFPreviewFrame } from '../components/ReportGenerator/PDFPreviewFrame';
import { TestData, ReportConfig } from '../types';

vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

vi.mock('lucide-react', () => ({
  BookOpenIcon: () => <div data-testid="book-open-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />,
  XIcon: () => <div data-testid="x-icon" />,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon" />,
}));

describe('PDFPreviewFrame', () => {
  let mockTestData: TestData;
  let mockConfig: ReportConfig;

  beforeEach(() => {
    mockTestData = {
      summary: { total: 100, passed: 75, failed: 20, skipped: 5, time: 120.5 },
      suites: [
        {
          name: 'Suite 1', tests: 50, failures: 10, errors: 0, skipped: 2,
          time: 60.0, timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            { name: 'Test 1', status: 'passed', suite: 'Suite 1', time: 1.5 },
            { name: 'Test 2', status: 'failed', suite: 'Suite 1', time: 2.1, errorMessage: 'Assertion failed' },
            { name: 'Test 3', status: 'skipped', suite: 'Suite 1', time: 0 },
          ],
        },
        {
          name: 'Suite 2', tests: 50, failures: 10, errors: 0, skipped: 3,
          time: 60.5, timestamp: '2024-01-01T12:01:00Z',
          testcases: [
            { name: 'Test 4', status: 'passed', suite: 'Suite 2', time: 1.2 },
            { name: 'Test 5', status: 'failed', suite: 'Suite 2', time: 2.8, errorMessage: 'Network timeout' },
          ],
        },
      ],
    };

    mockConfig = {
      title: 'Test Results Report',
      author: 'Test Author',
      projectName: 'Test Project',
      includeExecutiveSummary: true,
      includeTestMetrics: true,
      includeFailedTests: true,
      includeAllTests: true,
      includeResolutionProgress: true,
    };

    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => '{}'), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() },
      writable: true,
    });
  });

  it('should render the PDF preview frame with title and project', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText('Test Results Report')).toBeInTheDocument();
    // Project name appears in title and executive summary body
    expect(screen.getAllByText('Test Project').length).toBeGreaterThanOrEqual(1);
  });

  it('should render author when provided', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText(/Prepared by: Test Author/)).toBeInTheDocument();
  });

  it('should not render author when empty', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, author: '' }} />);
    expect(screen.queryByText(/Prepared by/)).not.toBeInTheDocument();
  });

  it('should not render project name when empty', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, projectName: '' }} />);
    expect(screen.queryByText('Test Project')).not.toBeInTheDocument();
  });

  it('should render Table of Contents', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText('Table of Contents')).toBeInTheDocument();
  });

  it('should display generated date', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    // Date appears in both title area and footer
    expect(screen.getAllByText(/Generated on/).length).toBeGreaterThanOrEqual(1);
  });

  it('should display test summary statistics', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    // Total appears in summary cards and metrics table
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1);
    // Pass rate
    expect(screen.getAllByText('75.0%').length).toBeGreaterThanOrEqual(1);
  });

  it('should render executive summary section heading with number', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    // Appears in both TOC and heading - use getAllByText
    const items = screen.getAllByText(/1\. Executive Summary/);
    expect(items.length).toBeGreaterThanOrEqual(2); // TOC + heading
  });

  it('should render executive summary description', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText(/This report provides an overview/)).toBeInTheDocument();
  });

  it('should not render executive summary when disabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, includeExecutiveSummary: false }} />);
    expect(screen.queryByText(/This report provides an overview/)).not.toBeInTheDocument();
  });

  it('should render test metrics when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const items = screen.getAllByText(/2\. Test Metrics/);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('should not render test metrics when disabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, includeTestMetrics: false }} />);
    expect(screen.queryByText('Test Results Distribution')).not.toBeInTheDocument();
  });

  it('should render chart components when metrics enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('should render metrics summary table', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText('Test Results Summary')).toBeInTheDocument();
    // Check for metric labels in the table - they may appear multiple times (chart legend + table)
    expect(screen.getAllByText('Passed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Skipped').length).toBeGreaterThan(0);
  });

  it('should render failed tests section when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const items = screen.getAllByText(/3\. Failed Tests/);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('should list failed test names in failed tests section', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    // Tests that failed
    const test2Elements = screen.getAllByText('Test 2');
    expect(test2Elements.length).toBeGreaterThan(0);
    const test5Elements = screen.getAllByText('Test 5');
    expect(test5Elements.length).toBeGreaterThan(0);
  });

  it('should not render failed tests section when disabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, includeFailedTests: false }} />);
    // Should not have the failed tests heading (only check headings, not TOC)
    expect(screen.queryByText('3. Failed Tests')).not.toBeInTheDocument();
  });

  it('should show all-passed message when no failed tests', () => {
    const passingData = {
      ...mockTestData,
      summary: { ...mockTestData.summary, failed: 0 },
      suites: [{
        ...mockTestData.suites[0],
        testcases: mockTestData.suites[0].testcases.map(t => ({ ...t, status: 'passed' as const })),
      }],
    };
    render(<PDFPreviewFrame testData={passingData} config={mockConfig} />);
    expect(screen.getByText('All tests passed successfully!')).toBeInTheDocument();
  });

  it('should render all tests section when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const items = screen.getAllByText(/4\. All Test Cases/);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('should not render all tests section when disabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, includeAllTests: false }} />);
    expect(screen.queryByText(/All Test Cases/)).not.toBeInTheDocument();
  });

  it('should render all test cases in the all-tests table', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    // Each test appears in both failed/summary sections and the all-tests table
    expect(screen.getAllByText('Test 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Test 4').length).toBeGreaterThan(0);
  });

  it('should render status icons for each test', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getAllByTestId('check-icon').length).toBeGreaterThan(0); // passed
    expect(screen.getAllByTestId('x-icon').length).toBeGreaterThan(0); // failed
    expect(screen.getAllByTestId('alert-circle-icon').length).toBeGreaterThan(0); // skipped
  });

  it('should display test durations', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getAllByText('1.50s').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2.10s').length).toBeGreaterThan(0);
  });

  it('should handle large datasets with optimization notice', () => {
    const large = {
      ...mockTestData,
      suites: [{
        ...mockTestData.suites[0],
        testcases: Array.from({ length: 3000 }, (_, i) => ({
          name: `Test ${i + 1}`, status: 'passed' as const, suite: 'Big Suite', time: 1.0,
        })),
      }],
    };
    render(<PDFPreviewFrame testData={large} config={mockConfig} />);
    expect(screen.getByText(/Showing first/)).toBeInTheDocument();
    expect(screen.getByText(/of 3000 total test cases/)).toBeInTheDocument();
  });

  it('should handle empty test data without crashing', () => {
    const empty: TestData = {
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, time: 0 },
      suites: [],
    };
    render(<PDFPreviewFrame testData={empty} config={mockConfig} />);
    expect(screen.getByText('Test Results Report')).toBeInTheDocument();
  });

  it('should render resolution progress section when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const items = screen.getAllByText(/5\. Failure Resolution Progress/);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('should not render resolution progress when disabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, includeResolutionProgress: false }} />);
    expect(screen.queryByText(/Failure Resolution Progress/)).not.toBeInTheDocument();
  });

  it('should show empty progress message when no data', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText('No failure resolution progress data available.')).toBeInTheDocument();
  });

  it('should handle localStorage errors gracefully', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => { throw new Error('localStorage error'); }) },
      writable: true,
    });
    expect(() => {
      render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    }).not.toThrow();
    expect(spy).toHaveBeenCalledWith('Could not access localStorage:', expect.any(Error));
    spy.mockRestore();
  });

  it('should use dynamic section numbering correctly', () => {
    // With exec summary off, metrics becomes 1, failed becomes 2, etc.
    const cfg = { ...mockConfig, includeExecutiveSummary: false };
    render(<PDFPreviewFrame testData={mockTestData} config={cfg} />);
    const metricItems = screen.getAllByText(/1\. Test Metrics/);
    expect(metricItems.length).toBeGreaterThanOrEqual(1);
    const failedItems = screen.getAllByText(/2\. Failed Tests/);
    expect(failedItems.length).toBeGreaterThanOrEqual(1);
  });

  it('should adjust numbering when failed tests disabled', () => {
    const cfg = { ...mockConfig, includeFailedTests: false };
    render(<PDFPreviewFrame testData={mockTestData} config={cfg} />);
    // Without failed tests, all tests is section 3
    const items = screen.getAllByText(/3\. All Test Cases/);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('should render A4-width container', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const frame = document.getElementById('report-preview');
    expect(frame).toBeInTheDocument();
    expect(frame?.style.width).toBe('794px');
  });

  it('should have proper padding for print margins', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const frame = document.getElementById('report-preview');
    // Root has zero padding; sections carry their own horizontal padding
    expect(frame?.style.padding).toBe('0px');
  });

  it('should render failed tests summary in executive summary when there are failures', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText(/20 tests failed/)).toBeInTheDocument();
  });

  it('should show all-passed message in exec summary when no failures', () => {
    const passing = {
      ...mockTestData,
      summary: { ...mockTestData.summary, failed: 0 },
      suites: [{
        ...mockTestData.suites[0],
        testcases: mockTestData.suites[0].testcases.map(t => ({ ...t, status: 'passed' as const })),
      }],
    };
    render(<PDFPreviewFrame testData={passing} config={mockConfig} />);
    expect(screen.getByText('All tests passed successfully.')).toBeInTheDocument();
  });

  it('should display failed test count in summary with correct percentage', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText(/20\.0% of total/)).toBeInTheDocument();
  });

  it('should limit failed tests in executive summary to first 5', () => {
    const data: TestData = {
      summary: { total: 10, passed: 0, failed: 10, skipped: 0, time: 10 },
      suites: [{
        name: 'S', tests: 10, failures: 10, errors: 0, skipped: 0, time: 10, timestamp: '',
        testcases: Array.from({ length: 10 }, (_, i) => ({
          name: `Fail ${i}`, status: 'failed' as const, time: 1,
        })),
      }],
    };
    render(<PDFPreviewFrame testData={data} config={mockConfig} />);
    expect(screen.getByText(/and 5 more/)).toBeInTheDocument();
  });

  it('should use pdf-content class on root element', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const frame = document.getElementById('report-preview');
    expect(frame?.classList.contains('pdf-content')).toBe(true);
  });

  it('should handle localStorage with progress data', () => {
    const progressData = JSON.stringify({
      test1: { name: 'Fail A', suite: 'S1', status: 'completed', assignee: 'Alice', notes: 'Fixed' },
      test2: { name: 'Fail B', suite: 'S2', status: 'in_progress', assignee: 'Bob', notes: '' },
    });
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => progressData) },
      writable: true,
    });
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText('Fail A')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Fixed')).toBeInTheDocument();
  });

  it('should show progress summary cards with correct counts', () => {
    const progressData = JSON.stringify({
      t1: { name: 'A', suite: 'S', status: 'completed' },
      t2: { name: 'B', suite: 'S', status: 'in_progress' },
      t3: { name: 'C', suite: 'S', status: 'not_started' },
    });
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => progressData) },
      writable: true,
    });
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    // Find the progress section summary cards
    const totalCards = screen.getAllByText('Total');
    expect(totalCards.length).toBeGreaterThan(0);
    // 1 completed + 1 in progress + 1 not started = 3 total
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });
});
