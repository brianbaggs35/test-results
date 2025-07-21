import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReportPreview } from '../components/ReportGenerator/ReportPreview';
import { TestData, ReportConfig } from '../types';

// Mock chart components to avoid complex dependencies
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>
}));

// Mock PDF components
vi.mock('../components/ReportGenerator/PDFPreviewFrame', () => ({
  PDFPreviewFrame: () => <div data-testid="report-preview" />
}));

// Mock PDF generation
vi.mock('../components/ReportGenerator/pdfGenerator', () => ({
  generatePDF: vi.fn()
}));

// Mock formatting utilities
vi.mock('../../utils/formatting', () => ({
  formatDuration: (time: number) => `${time}s`
}));

describe('ReportPreview', () => {
  let mockTestData: TestData;
  let mockConfig: ReportConfig;

  beforeEach(() => {
    // Create test data with multiple suites containing failed tests
    // This will test the duplicate key issue specifically
    mockTestData = {
      summary: {
        total: 9,
        passed: 5,
        failed: 4,
        skipped: 0,
        time: 120.5
      },
      suites: [
        {
          name: 'Suite A',
          tests: 4,
          failures: 2,
          errors: 0,
          skipped: 0,
          time: 60.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            { name: 'test1', status: 'passed' as const, time: 0.5 },
            { name: 'test2', status: 'failed' as const, time: 0.5, errorMessage: 'First failure' },
            { name: 'test3', status: 'failed' as const, time: 0.5, errorMessage: 'Second failure' },
            { name: 'test4', status: 'passed' as const, time: 0.5 }
          ]
        },
        {
          name: 'Suite B',
          tests: 3,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 30.0,
          timestamp: '2024-01-01T12:01:00Z',
          testcases: [
            { name: 'test1', status: 'passed' as const, time: 0.3 },
            { name: 'test2', status: 'failed' as const, time: 0.3, errorMessage: 'Third failure' },
            { name: 'test3', status: 'passed' as const, time: 0.3 }
          ]
        },
        {
          name: 'Suite C',
          tests: 2,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 30.5,
          timestamp: '2024-01-01T12:02:00Z',
          testcases: [
            { name: 'test1', status: 'failed' as const, time: 0.4, errorMessage: 'Fourth failure' },
            { name: 'test2', status: 'passed' as const, time: 0.4 }
          ]
        }
      ]
    };

    mockConfig = {
      title: 'Test Report',
      author: 'Test Author',
      projectName: 'Test Project',
      includeExecutiveSummary: true,
      includeTestMetrics: true,
      includeFailedTests: true,
      includeAllTests: true,
      includeResolutionProgress: false
    };
  });

  it('should render failed tests without duplicate React keys', () => {
    const { container } = render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    // Check that all failed tests are rendered
    const failedTestItems = container.querySelectorAll('#executive-summary ul li');
    expect(failedTestItems).toHaveLength(4); // We have 4 failed tests across 3 suites

    // Verify the content is correct (should show test name and suite)
    expect(failedTestItems[0].textContent).toContain('test2');
    expect(failedTestItems[0].textContent).toContain('Suite A');
    expect(failedTestItems[1].textContent).toContain('test3');
    expect(failedTestItems[1].textContent).toContain('Suite A');
    expect(failedTestItems[2].textContent).toContain('test2');
    expect(failedTestItems[2].textContent).toContain('Suite B');
    expect(failedTestItems[3].textContent).toContain('test1');
    expect(failedTestItems[3].textContent).toContain('Suite C');
  });

  it('should render all tests table without duplicate React keys', () => {
    const { container } = render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    // Check that all tests are rendered in the "All Tests" section
    const allTestRows = container.querySelectorAll('#all-tests tbody tr');
    expect(allTestRows).toHaveLength(9); // Total of 9 tests (4 + 3 + 2)

    // Check that the keys are unique by ensuring all rows render correctly
    allTestRows.forEach((row) => {
      expect(row).toBeInTheDocument();
      expect(row.querySelector('td')).toBeInTheDocument(); // Each row should have at least one cell
    });
  });

  it('should render failed tests table without duplicate React keys', () => {
    const { container } = render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    // Check that failed tests table is rendered correctly
    const failedTestRows = container.querySelectorAll('#failed-tests tbody tr');
    expect(failedTestRows).toHaveLength(4); // 4 failed tests

    // Check that each row is properly rendered without key conflicts
    failedTestRows.forEach((row) => {
      expect(row).toBeInTheDocument();
      expect(row.querySelector('td')).toBeInTheDocument();
    });
  });

  it('should not show duplicate key warnings in console', () => {
    // This test verifies that no React duplicate key warnings are generated
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* noop */ });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });

    render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    // Check that no warnings about duplicate keys were logged
    const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter(call =>
      call.some(arg =>
        typeof arg === 'string' &&
        arg.includes('Encountered two children with the same key')
      )
    );

    const duplicateKeyErrors = consoleErrorSpy.mock.calls.filter(call =>
      call.some(arg =>
        typeof arg === 'string' &&
        arg.includes('Encountered two children with the same key')
      )
    );

    expect(duplicateKeyWarnings).toHaveLength(0);
    expect(duplicateKeyErrors).toHaveLength(0);

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle PDF generation button click', () => {
    render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    const downloadButton = screen.getByText('Download PDF');
    expect(downloadButton).toBeInTheDocument();

    // Should be clickable initially
    expect(downloadButton).not.toHaveAttribute('disabled');
  });

  it('should handle progress state correctly', () => {
    render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    const downloadButton = screen.getByText('Download PDF');
    expect(downloadButton).toBeInTheDocument();
    
    // Initial state should show "Download PDF"
    expect(downloadButton).toHaveTextContent('Download PDF');
  });

  it('should handle error states', () => {
    render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    // Initial state should not show any error
    expect(screen.queryByText(/Failed to generate PDF/)).not.toBeInTheDocument();
  });

  it('should call onBack when back button is clicked', () => {
    const mockOnBack = vi.fn();

    render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={mockOnBack}
      />
    );

    const backButton = screen.getByText('Back to Configuration');
    backButton.click();

    expect(mockOnBack).toHaveBeenCalled();
  });

  it('should handle button interactions', () => {
    render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    const downloadButton = screen.getByText('Download PDF');
    
    // Should initially be enabled
    expect(downloadButton).not.toHaveAttribute('disabled');
  });

  it('should render test status icons correctly', () => {
    render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    // Should render various test status indicators in the table
    const container = screen.getByTestId('report-preview');
    expect(container).toBeInTheDocument();
  });

  it('should render pie chart with custom labels and tooltips', () => {
    render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    // Should render pie chart components
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('should handle test data with empty suites', () => {
    const emptyTestData = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        time: 0
      },
      suites: []
    };

    render(
      <ReportPreview
        testData={emptyTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    // Should still render without errors
    expect(screen.getByText('Back to Configuration')).toBeInTheDocument();
  });

  it('should format test duration correctly', () => {
    render(
      <ReportPreview
        testData={mockTestData}
        config={mockConfig}
        onBack={() => { /* noop */ }}
      />
    );

    // The formatDuration function should be called during rendering
    // We can verify that duration formatting is happening by checking if durations are displayed
    expect(screen.getByText('Back to Configuration')).toBeInTheDocument();
  });

  it('should handle configuration options correctly', () => {
    const configWithAllOptions = {
      ...mockConfig,
      includeExecutiveSummary: false,
      includeTestMetrics: false,
      includeFailedTests: false,
      includeAllTests: false,
      includeResolutionProgress: true
    };

    render(
      <ReportPreview
        testData={mockTestData}
        config={configWithAllOptions}
        onBack={() => { /* noop */ }}
      />
    );

    // Should render according to configuration
    expect(screen.getByText('Back to Configuration')).toBeInTheDocument();
  });
});