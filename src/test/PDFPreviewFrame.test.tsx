import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PDFPreviewFrame } from '../components/ReportGenerator/PDFPreviewFrame';
import { TestData, ReportConfig } from '../types';

// Mock Recharts components to avoid SVG rendering issues in tests
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  BookOpenIcon: () => <div data-testid="book-open-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />,
  XIcon: () => <div data-testid="x-icon" />,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon" />
}));

describe('PDFPreviewFrame', () => {
  let mockTestData: TestData;
  let mockConfig: ReportConfig;

  beforeEach(() => {
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
          testcases: [
            {
              name: 'Test 1',
              status: 'passed',
              suite: 'Suite 1',
              time: 1.5
            },
            {
              name: 'Test 2',
              status: 'failed',
              suite: 'Suite 1',
              time: 2.1,
              errorMessage: 'Assertion failed'
            },
            {
              name: 'Test 3',
              status: 'skipped',
              suite: 'Suite 1',
              time: 0
            }
          ]
        },
        {
          name: 'Suite 2',
          tests: 50,
          failures: 10,
          errors: 0,
          skipped: 3,
          time: 60.5,
          timestamp: '2024-01-01T12:01:00Z',
          testcases: [
            {
              name: 'Test 4',
              status: 'passed',
              suite: 'Suite 2',
              time: 1.2
            },
            {
              name: 'Test 5',
              status: 'failed',
              suite: 'Suite 2',
              time: 2.8,
              errorMessage: 'Network timeout'
            }
          ]
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

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => '{}'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    });
  });

  it('should render the PDF preview frame with basic content', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText('Test Results Report')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('1. Executive Summary')).toBeInTheDocument();
  });

  it('should display test summary statistics correctly', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getAllByText('100')).toHaveLength(2); // Total tests appears in multiple places
    expect(screen.getByText('75')).toBeInTheDocument(); // Passed tests
    expect(screen.getByText('20')).toBeInTheDocument(); // Failed tests
    expect(screen.getByText('5')).toBeInTheDocument(); // Skipped tests
  });

  it('should show pass rate calculation', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText('75.0%')).toBeInTheDocument(); // Pass rate
  });

  it('should render executive summary when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText('1. Executive Summary')).toBeInTheDocument();
    expect(screen.getByText(/This report provides an overview/)).toBeInTheDocument();
  });

  it('should not render executive summary when disabled', () => {
    const configWithoutSummary = { ...mockConfig, includeExecutiveSummary: false };
    render(<PDFPreviewFrame testData={mockTestData} config={configWithoutSummary} />);

    expect(screen.queryByText('1. Executive Summary')).not.toBeInTheDocument();
  });

  it('should render failed tests section when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText(/Failed Test Cases/)).toBeInTheDocument();
  });

  it('should not render failed tests section when disabled', () => {
    const configWithoutFailed = { ...mockConfig, includeFailedTests: false };
    render(<PDFPreviewFrame testData={mockTestData} config={configWithoutFailed} />);

    expect(screen.queryByText(/Failed Test Cases/)).not.toBeInTheDocument();
  });

  it('should render all tests section when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText(/All Test Cases/)).toBeInTheDocument();
    expect(screen.getByText('Test 1')).toBeInTheDocument();
    expect(screen.getByText('Test 2')).toBeInTheDocument();
  });

  it('should not render all tests section when disabled', () => {
    const configWithoutAll = { ...mockConfig, includeAllTests: false };
    render(<PDFPreviewFrame testData={mockTestData} config={configWithoutAll} />);

    expect(screen.queryByText(/All Test Cases/)).not.toBeInTheDocument();
  });

  it('should handle large datasets with optimization notice', () => {
    // Create a large dataset
    const largeTestData = {
      ...mockTestData,
      summary: {
        ...mockTestData.summary,
        total: 10000
      },
      suites: [
        {
          ...mockTestData.suites[0],
          testcases: Array.from({ length: 3000 }, (_, index) => ({
            name: `Test ${index + 1}`,
            status: 'passed' as const,
            suite: 'Large Suite',
            time: 1.0
          }))
        }
      ]
    };

    render(<PDFPreviewFrame testData={largeTestData} config={mockConfig} />);

    expect(screen.getByText(/PDF Optimization: Showing first/)).toBeInTheDocument();
    expect(screen.getByText(/of 3000 total test cases/)).toBeInTheDocument();
  });

  it('should display test duration formatting', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    // Check for formatted test durations
    expect(screen.getByText('1.50s')).toBeInTheDocument(); // Test 1 duration
    expect(screen.getByText('2.10s')).toBeInTheDocument(); // Test 2 duration
  });

  it('should handle empty test data gracefully', () => {
    const emptyTestData: TestData = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        time: 0
      },
      suites: []
    };

    render(<PDFPreviewFrame testData={emptyTestData} config={mockConfig} />);

    expect(screen.getByText('Test Results Report')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should render resolution progress section when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText('5. Failure Resolution Progress')).toBeInTheDocument();
  });

  it('should not render resolution progress when disabled', () => {
    const configWithoutProgress = { ...mockConfig, includeResolutionProgress: false };
    render(<PDFPreviewFrame testData={mockTestData} config={configWithoutProgress} />);

    expect(screen.queryByText('5. Failure Resolution Progress')).not.toBeInTheDocument();
  });

  it('should handle localStorage errors gracefully', () => {
    // Mock localStorage to throw an error
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => {
          throw new Error('localStorage error');
        })
      },
      writable: true
    });

    // Should not throw and should render normally
    expect(() => {
      render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    }).not.toThrow();

    expect(screen.getByText('Test Results Report')).toBeInTheDocument();
  });

  it('should display correct test status indicators', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getAllByTestId('check-icon')).toHaveLength(2); // For passed tests
    expect(screen.getAllByTestId('x-icon')).toHaveLength(2); // For failed tests
    expect(screen.getAllByTestId('alert-circle-icon')).toHaveLength(1); // For skipped test
  });

  it('should show proper section numbering based on included sections', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText('1. Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('3. Failed Tests')).toBeInTheDocument();
    expect(screen.getByText(/4. All Test Cases/)).toBeInTheDocument();
    expect(screen.getByText(/5. Failure Resolution Progress/)).toBeInTheDocument();
  });

  it('should adjust section numbering when failed tests section is disabled', () => {
    const configPartial = {
      ...mockConfig,
      includeFailedTests: false
    };

    render(<PDFPreviewFrame testData={mockTestData} config={configPartial} />);

    expect(screen.getByText('1. Executive Summary')).toBeInTheDocument();
    // When failed tests is disabled, All Test Cases should be section 3
    expect(screen.getByText(/3. All Test Cases/)).toBeInTheDocument();
  });

  it('should handle tests without assignee properly', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getAllByText('Unassigned')).toHaveLength(5); // All tests should show "Unassigned"
  });
});