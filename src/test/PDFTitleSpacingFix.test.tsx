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

describe('PDF Title Spacing Fix', () => {
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

  it('should render PDF title with proper spacing', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText('Automated Test Results Report')).toBeInTheDocument();
  });

  it('should render executive summary text with proper spacing', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText(/This report provides an overview/)).toBeInTheDocument();
  });

  it('should display custom title correctly', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{ ...mockConfig, title: 'Custom Title' }} />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('should not have collapsed title text', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const el = screen.getByText('Automated Test Results Report');
    expect(el.textContent).toBe('Automated Test Results Report');
    expect(screen.queryByText('AutomatedTestResultsReport')).not.toBeInTheDocument();
  });

  it('should render table of contents entries', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.getByText('Table of Contents')).toBeInTheDocument();
    // TOC entries include numbered section names
    expect(screen.getAllByText(/Executive Summary/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Test Metrics/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Failed Tests/).length).toBeGreaterThanOrEqual(1);
  });
});
