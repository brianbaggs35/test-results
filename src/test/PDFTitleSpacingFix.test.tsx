import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PDFPreviewFrame } from '../components/ReportGenerator/PDFPreviewFrame';
import { TestData, ReportConfig } from '../types';

// Mock recharts components
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>
}));

// Mock useChartRenderComplete hook
vi.mock('../hooks/useChartRenderComplete', () => ({
  useChartRenderComplete: () => {}
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  BookOpenIcon: () => <div data-testid="book-open-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />,
  XIcon: () => <div data-testid="x-icon" />,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon" />
}));

describe('PDF Title Spacing Fix', () => {
  const mockTestData: TestData = {
    summary: {
      total: 10,
      passed: 8,
      failed: 2,
      skipped: 0,
      time: 120.5
    },
    suites: [
      {
        name: 'Test Suite',
        tests: 10,
        failures: 2,
        errors: 0,
        skipped: 0,
        time: 120.5,
        timestamp: '2024-01-01T12:00:00Z',
        testcases: [
          {
            name: 'Test 1',
            status: 'passed',
            suite: 'Test Suite',
            time: 10.0
          },
          {
            name: 'Test 2',
            status: 'failed',
            suite: 'Test Suite',
            time: 15.0,
            errorMessage: 'Test failed'
          }
        ]
      }
    ]
  };

  const mockConfig: ReportConfig = {
    title: 'Automated Test Results Report',
    author: 'Test Author',
    projectName: 'Test Project',
    includeExecutiveSummary: true,
    includeTestMetrics: true,
    includeFailedTests: true,
    includeAllTests: false,
    includeResolutionProgress: false
  };

  it('should render PDF title with proper spacing', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    // Check that the title appears with proper spaces
    expect(screen.getByText('Automated Test Results Report')).toBeInTheDocument();
  });

  it('should render executive summary text with proper spacing', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    // Check that the executive summary text has proper spacing
    expect(screen.getByText(/This report provides an overview of the automated test results/)).toBeInTheDocument();
  });

  it('should display report title correctly in PDF preview', () => {
    const customConfig = {
      ...mockConfig,
      title: 'Custom Automated Tests Results'
    };

    render(<PDFPreviewFrame testData={mockTestData} config={customConfig} />);

    expect(screen.getByText('Custom Automated Tests Results')).toBeInTheDocument();
  });

  it('should not have missing spaces in PDF headings', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    // Check for common patterns that might have missing spaces
    const element = screen.getByText('Automated Test Results Report');
    expect(element.textContent).toBe('Automated Test Results Report');
    
    // Ensure no collapsed text without spaces
    expect(screen.queryByText('AutomatedTestResultsReport')).not.toBeInTheDocument();
    expect(screen.queryByText('automatedtestresults')).not.toBeInTheDocument();
  });

  it('should render table of contents with proper text spacing', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText('Table of Contents')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('Test Metrics')).toBeInTheDocument();
    expect(screen.getAllByText('Failed Tests')).toHaveLength(2); // In TOC and section header
  });
});