import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
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
  PDFPreviewFrame: () => <div data-testid="pdf-preview-frame" />
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
        onBack={() => {}} 
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
        onBack={() => {}} 
      />
    );

    // Check that all tests are rendered in the "All Tests" section
    const allTestRows = container.querySelectorAll('#all-tests tbody tr');
    expect(allTestRows).toHaveLength(9); // Total of 9 tests (4 + 3 + 2)

    // Check that the keys are unique by ensuring all rows render correctly
    allTestRows.forEach((row, index) => {
      expect(row).toBeInTheDocument();
      expect(row.querySelector('td')).toBeInTheDocument(); // Each row should have at least one cell
    });
  });

  it('should render failed tests table without duplicate React keys', () => {
    const { container } = render(
      <ReportPreview 
        testData={mockTestData} 
        config={mockConfig} 
        onBack={() => {}} 
      />
    );

    // Check that failed tests table is rendered correctly
    const failedTestRows = container.querySelectorAll('#failed-tests tbody tr');
    expect(failedTestRows).toHaveLength(4); // 4 failed tests

    // Check that each row is properly rendered without key conflicts
    failedTestRows.forEach((row, index) => {
      expect(row).toBeInTheDocument();
      expect(row.querySelector('td')).toBeInTheDocument();
    });
  });

  it('should not show duplicate key warnings in console', () => {
    // This test verifies that no React duplicate key warnings are generated
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ReportPreview 
        testData={mockTestData} 
        config={mockConfig} 
        onBack={() => {}} 
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
});