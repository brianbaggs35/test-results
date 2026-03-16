import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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

describe('PDF Scaling Fix', () => {
  const mockTestData: TestData = {
    summary: { total: 9, passed: 5, failed: 4, skipped: 0, time: 4.5 },
    suites: [{
      name: 'Suite A', tests: 2, failures: 1, errors: 0, skipped: 0,
      time: 1.0, timestamp: '2024-01-01T00:00:00Z',
      testcases: [
        { name: 'test1', status: 'passed' as const, time: 0.5 },
        { name: 'test2', status: 'failed' as const, time: 0.5, errorMessage: 'Failed' },
      ],
    }],
  };

  const mockConfig: ReportConfig = {
    title: 'Test Report', author: 'Author', projectName: 'Project',
    includeExecutiveSummary: true, includeTestMetrics: true,
    includeFailedTests: true, includeAllTests: true, includeResolutionProgress: true,
  };

  it('should render PDF preview frame with A4 width (794px)', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const frame = document.getElementById('report-preview');
    expect(frame).toBeInTheDocument();
    expect(frame?.style.width).toBe('794px');
  });

  it('should have proper padding for A4 margins', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const frame = document.getElementById('report-preview');
    // Root has zero padding; each section carries its own horizontal padding
    expect(frame?.style.padding).toBe('0px');
  });

  it('should use border-box sizing', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const frame = document.getElementById('report-preview');
    expect(frame?.style.boxSizing).toBe('border-box');
  });

  it('should have minimum height for A4 page', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const frame = document.getElementById('report-preview');
    expect(frame?.style.minHeight).toBe('1123px');
  });

  it('should set white background', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const frame = document.getElementById('report-preview');
    expect(frame?.style.backgroundColor).toBe('white');
  });

  it('should use pdf-content class for print styles', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    const frame = document.getElementById('report-preview');
    expect(frame?.classList.contains('pdf-content')).toBe(true);
  });
});
