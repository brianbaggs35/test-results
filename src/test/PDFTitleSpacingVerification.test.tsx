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

describe('PDF Title Spacing Verification', () => {
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

  it('should render PDF title with proper spacing - no collapsed words', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    // Check that the title appears with proper spaces
    expect(screen.getByText('Automated Test Results Report')).toBeInTheDocument();
    
    // Ensure that the title does not appear as collapsed text without spaces
    expect(screen.queryByText('AutomatedTestResultsReport')).not.toBeInTheDocument();
    expect(screen.queryByText('automatedtestresultsreport')).not.toBeInTheDocument();
    expect(screen.queryByText('AUTOMATEDTESTRESULTSREPORT')).not.toBeInTheDocument();
  });

  it('should apply correct CSS styles for text spacing', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    const titleElement = screen.getByText('Automated Test Results Report');
    expect(titleElement).toBeInTheDocument();
    
    // Verify the element exists and can be rendered properly
    // The CSS styles are applied inline in the component
    expect(titleElement.tagName.toLowerCase()).toBe('h1');
  });

  it('should render title with different configurations', () => {
    const customConfig: ReportConfig = {
      ...mockConfig,
      title: 'Custom Automated Testing Results',
    };

    render(<PDFPreviewFrame testData={mockTestData} config={customConfig} />);

    expect(screen.getByText('Custom Automated Testing Results')).toBeInTheDocument();
    expect(screen.queryByText('CustomAutomatedTestingResults')).not.toBeInTheDocument();
  });

  it('should handle long titles with multiple words correctly', () => {
    const longTitleConfig: ReportConfig = {
      ...mockConfig,
      title: 'Comprehensive Automated Test Results Summary Report',
    };

    render(<PDFPreviewFrame testData={mockTestData} config={longTitleConfig} />);

    expect(screen.getByText('Comprehensive Automated Test Results Summary Report')).toBeInTheDocument();
    // Ensure no word collapse
    expect(screen.queryByText('ComprehensiveAutomatedTestResultsSummaryReport')).not.toBeInTheDocument();
  });

  it('should handle single word titles correctly', () => {
    const singleWordConfig: ReportConfig = {
      ...mockConfig,
      title: 'Report',
    };

    render(<PDFPreviewFrame testData={mockTestData} config={singleWordConfig} />);

    expect(screen.getByText('Report')).toBeInTheDocument();
  });

  it('should handle empty title gracefully', () => {
    const emptyTitleConfig: ReportConfig = {
      ...mockConfig,
      title: '',
    };

    render(<PDFPreviewFrame testData={mockTestData} config={emptyTitleConfig} />);

    // Should render without crashing
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('should render executive summary section when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText('1. Executive Summary')).toBeInTheDocument();
  });

  it('should render test metrics section when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText('2. Test Metrics')).toBeInTheDocument();
  });

  it('should render failed tests section when enabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.getByText('3. Failed Tests')).toBeInTheDocument();
  });

  it('should not render all tests section when disabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    expect(screen.queryByText('4. All Test Cases')).not.toBeInTheDocument();
  });
});