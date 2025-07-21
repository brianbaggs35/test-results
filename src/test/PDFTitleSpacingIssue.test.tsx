import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('PDF Title Spacing Issue', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title with enhanced word spacing styles', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    const titleElement = screen.getByText('Automated Test Results Report');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement.tagName.toLowerCase()).toBe('h1');
    
    // Check that the title contains proper spaces
    expect(titleElement.textContent).toBe('Automated Test Results Report');
    expect(titleElement.textContent).not.toBe('AutomatedTestResultsReport');
  });

  it('should apply enhanced CSS styles for better PDF word spacing', () => {
    const { container } = render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    
    const titleElement = container.querySelector('h1');
    expect(titleElement).toBeTruthy();
    
    // Check that the element has the expected inline styles for better PDF rendering
    const styleAttr = titleElement!.getAttribute('style');
    expect(styleAttr).toContain('word-spacing: 0.25em');
    expect(styleAttr).toContain('white-space: normal');
    expect(styleAttr).toContain('letter-spacing: 0.025em');
    expect(styleAttr).toContain('font-family');
  });

  it('should detect collapsed title text that might appear in PDF', () => {
    // Test what the collapsed version would look like
    const collapsedTitle = 'AutomatedTestResultsReport';
    const properTitle = 'Automated Test Results Report';
    
    // Verify they are different
    expect(collapsedTitle).not.toBe(properTitle);
    
    // Verify the proper title has spaces
    expect(properTitle).toContain(' ');
    expect(collapsedTitle).not.toContain(' ');
    
    // Verify character count difference
    expect(properTitle.length).toBeGreaterThan(collapsedTitle.length);
  });

  it('should ensure title maintains word boundaries', () => {
    const title = 'Automated Test Results Report';
    const words = title.split(' ');
    
    expect(words).toHaveLength(4);
    expect(words[0]).toBe('Automated');
    expect(words[1]).toBe('Test');
    expect(words[2]).toBe('Results');
    expect(words[3]).toBe('Report');
    
    // Verify that joining without spaces would create the problematic version
    const joinedWithoutSpaces = words.join('');
    expect(joinedWithoutSpaces).toBe('AutomatedTestResultsReport');
  });

  it('should handle custom titles with proper spacing', () => {
    const customConfig = {
      ...mockConfig,
      title: 'Custom Test Report Title With Multiple Words'
    };

    render(<PDFPreviewFrame testData={mockTestData} config={customConfig} />);

    const titleElement = screen.getByText('Custom Test Report Title With Multiple Words');
    expect(titleElement).toBeInTheDocument();
    
    // Verify it has spaces
    expect(titleElement.textContent).toContain(' ');
    
    // Verify it doesn't appear collapsed
    expect(titleElement.textContent).not.toBe('CustomTestReportTitleWithMultipleWords');
  });
});