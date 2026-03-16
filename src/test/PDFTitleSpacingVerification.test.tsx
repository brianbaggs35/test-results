import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PDFPreviewFrame } from '../components/ReportGenerator/PDFPreviewFrame';
import { TestData, ReportConfig } from '../types';

vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

vi.mock('lucide-react', () => ({
  BookOpenIcon: () => <div data-testid="book-open-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />,
  XIcon: () => <div data-testid="x-icon" />,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon" />,
}));

describe('PDF Title Spacing Verification', () => {
  const mockTestData: TestData = {
    summary: { total: 10, passed: 8, failed: 2, skipped: 0, time: 120.5 },
    suites: [{
      name: 'Test Suite', tests: 10, failures: 2, errors: 0, skipped: 0,
      time: 120.5, timestamp: '2024-01-01T12:00:00Z',
      testcases: [
        { name: 'Test 1', status: 'passed', suite: 'Test Suite', time: 10.0 },
        { name: 'Test 2', status: 'failed', suite: 'Test Suite', time: 15.0, errorMessage: 'Failed' },
      ],
    }],
  };

  const mockConfig: ReportConfig = {
    title: 'Automated Test Results Report', author: 'Test Author',
    projectName: 'Test Project',
    includeExecutiveSummary: true, includeTestMetrics: true,
    includeFailedTests: true, includeAllTests: false, includeResolutionProgress: false,
  };

  it('should render title without collapsed words', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText('Automated Test Results Report')).toBeInTheDocument();
    expect(screen.queryByText('AutomatedTestResultsReport')).not.toBeInTheDocument();
  });

  it('should apply styles to h1 title element', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const title = screen.getByText('Automated Test Results Report');
    expect(title.tagName.toLowerCase()).toBe('h1');
  });

  it('should render different title values correctly', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, title: 'Custom Automated Testing Results' }} />);
    expect(screen.getByText('Custom Automated Testing Results')).toBeInTheDocument();
  });

  it('should handle long titles', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{
      ...mockConfig, title: 'Comprehensive Automated Test Results Summary Report',
    }} />);
    expect(screen.getByText('Comprehensive Automated Test Results Summary Report')).toBeInTheDocument();
  });

  it('should handle single word titles', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, title: 'Report' }} />);
    expect(screen.getByText('Report')).toBeInTheDocument();
  });

  it('should handle empty title', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, title: '' }} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('should render executive summary heading with section number', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    // Both in TOC and as section heading
    expect(screen.getAllByText(/1\. Executive Summary/).length).toBeGreaterThanOrEqual(2);
  });

  it('should render test metrics heading with section number', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getAllByText(/2\. Test Metrics/).length).toBeGreaterThanOrEqual(2);
  });

  it('should render failed tests heading with section number', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getAllByText(/3\. Failed Tests/).length).toBeGreaterThanOrEqual(2);
  });

  it('should not render all tests when disabled', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.queryByText(/All Test Cases/)).not.toBeInTheDocument();
  });
});
