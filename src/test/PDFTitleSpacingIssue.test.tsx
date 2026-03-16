import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('PDF Title Spacing Issue', () => {
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

  beforeEach(() => { vi.clearAllMocks(); });

  it('should render title with proper word spacing', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const title = screen.getByText('Automated Test Results Report');
    expect(title).toBeInTheDocument();
    expect(title.tagName.toLowerCase()).toBe('h1');
    expect(title.textContent).toBe('Automated Test Results Report');
  });

  it('should render title as h1 element', () => {
    const { container } = render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const h1 = container.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1?.textContent).toContain('Automated Test Results Report');
  });

  it('should detect that collapsed text is not present', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    expect(screen.queryByText('AutomatedTestResultsReport')).not.toBeInTheDocument();
  });

  it('should maintain word boundaries in title', () => {
    const title = 'Automated Test Results Report';
    const words = title.split(' ');
    expect(words).toHaveLength(4);
    expect(words[0]).toBe('Automated');
    expect(words[1]).toBe('Test');
    expect(words[2]).toBe('Results');
    expect(words[3]).toBe('Report');
  });

  it('should handle custom titles with multiple words', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={{
      ...mockConfig, title: 'Custom Test Report Title With Multiple Words',
    }} />);
    const el = screen.getByText('Custom Test Report Title With Multiple Words');
    expect(el.textContent).toContain(' ');
  });
});
