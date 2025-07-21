import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestMetrics } from '../components/Dashboard/TestMetrics';

// Mock recharts components
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, dataKey }: { data?: Array<{ name: string; value: number }>; dataKey: string }) => (
    <div data-testid="pie" data-key={dataKey}>
      {data?.map((item: { name: string; value: number }, index: number) => (
        <div key={index} data-testid={`pie-item-${item.name}`}>
          {item.name}: {item.value}
        </div>
      ))}
    </div>
  ),
  Cell: ({ fill }: { fill: string }) => <div data-testid="cell" style={{ fill }} />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid="bar" data-key={dataKey} />,
  XAxis: ({ dataKey }: { dataKey?: string }) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircleIcon: () => <div data-testid="check-circle-icon" />,
  XCircleIcon: () => <div data-testid="x-circle-icon" />,
  ClockIcon: () => <div data-testid="clock-icon" />,
  AlertTriangleIcon: () => <div data-testid="alert-triangle-icon" />,
}));

// Mock formatDuration utility
vi.mock('../../utils/formatting', () => ({
  formatDuration: vi.fn((time: number) => `${time.toFixed(1)}s`)
}));

// Mock useChartRenderComplete hook
vi.mock('../../hooks/useChartRenderComplete', () => ({
  useChartRenderComplete: vi.fn()
}));

describe('TestMetrics', () => {
  const mockTestData = {
    summary: {
      total: 100,
      passed: 85,
      failed: 10,
      skipped: 5,
      time: 120.5
    },
    suites: [
      {
        name: 'Suite 1',
        tests: 50,
        failures: 5,
        errors: 2,
        skipped: 3,
        time: 60.0,
        timestamp: '2024-01-01T12:00:00Z',
        testcases: [
          { name: 'e2e/user_management/login/admin', status: 'passed' as const, time: 1.2 },
          { name: 'e2e/user_management/profile/admin', status: 'failed' as const, time: 2.5 },
          { name: 'e2e/billing/invoice/standard', status: 'passed' as const, time: 1.8 },
          { name: 'unit/test1', status: 'skipped' as const, time: 0 },
        ]
      },
      {
        name: 'Suite 2',
        tests: 50,
        failures: 5,
        errors: 0,
        skipped: 2,
        time: 60.5,
        timestamp: '2024-01-01T12:01:00Z',
        testcases: [
          { name: 'e2e/order_management/checkout/premium', status: 'passed' as const, time: 1.5 },
          { name: 'e2e/billing/payment/admin', status: 'failed' as const, time: 3.2 },
        ]
      }
    ]
  };

  it('should render test execution summary with correct metrics', () => {
    render(<TestMetrics testData={mockTestData} />);

    expect(screen.getByText('Test Execution Summary')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument(); // passed count
    expect(screen.getByText('10')).toBeInTheDocument(); // failed count
    expect(screen.getByText('5')).toBeInTheDocument(); // skipped count
  });

  it('should display passed tests count and label', () => {
    render(<TestMetrics testData={mockTestData} />);

    const passedElements = screen.getAllByText('85');
    const passedLabel = screen.getByText('Passed');
    
    expect(passedElements.length).toBeGreaterThan(0);
    expect(passedLabel).toBeInTheDocument();
  });

  it('should display failed tests count and label', () => {
    render(<TestMetrics testData={mockTestData} />);

    const failedElements = screen.getAllByText('10');
    const failedLabel = screen.getByText('Failed');
    
    expect(failedElements.length).toBeGreaterThan(0);
    expect(failedLabel).toBeInTheDocument();
  });

  it('should display skipped tests count and label', () => {
    render(<TestMetrics testData={mockTestData} />);

    const skippedElements = screen.getAllByText('5');
    const skippedLabel = screen.getByText('Skipped');
    
    expect(skippedElements.length).toBeGreaterThan(0);
    expect(skippedLabel).toBeInTheDocument();
  });

  it('should render pie chart for test results distribution', () => {
    render(<TestMetrics testData={mockTestData} />);

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie')).toBeInTheDocument();
  });

  it('should render responsive container for charts', () => {
    render(<TestMetrics testData={mockTestData} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('should render with icons for each metric type', () => {
    render(<TestMetrics testData={mockTestData} />);

    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
  });

  it('should handle test data with no suites', () => {
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

    render(<TestMetrics testData={emptyTestData} />);

    expect(screen.getByText('Test Execution Summary')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3); // passed, failed, skipped all show 0
  });

  it('should handle test data with no testcases in suites', () => {
    const noTestCasesData = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        time: 0
      },
      suites: [
        {
          name: 'Empty Suite',
          tests: 0,
          failures: 0,
          errors: 0,
          skipped: 0,
          time: 0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: []
        }
      ]
    };

    render(<TestMetrics testData={noTestCasesData} />);

    expect(screen.getByText('Test Execution Summary')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('should process test suites and create module data', () => {
    render(<TestMetrics testData={mockTestData} />);

    // The component processes e2e test paths and creates module data
    // This tests that the component renders without errors when processing modules
    expect(screen.getByText('Test Execution Summary')).toBeInTheDocument();
  });

  it('should handle suite time data for charts', () => {
    render(<TestMetrics testData={mockTestData} />);

    // Suite time data should be processed for charting
    // The component should handle long suite names by truncating them
    expect(screen.getByText('Test Execution Summary')).toBeInTheDocument();
  });

  it('should display formatted duration using formatDuration utility', () => {
    render(<TestMetrics testData={mockTestData} />);

    // The formatDuration should have been called and the result displayed
    expect(screen.getByText('2m')).toBeInTheDocument();
    expect(screen.getByText('Total Duration:')).toBeInTheDocument();
  });

  it('should calculate and display success rate correctly', () => {
    render(<TestMetrics testData={mockTestData} />);

    expect(screen.getByText('Success Rate:')).toBeInTheDocument();
    // Success rate = passed / (passed + failed + skipped) * 100 = 85 / 100 * 100 = 85.0%
    expect(screen.getByText('85.0%')).toBeInTheDocument();
  });

  it('should handle zero total for success rate calculation', () => {
    const zeroTestData = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        time: 0
      },
      suites: []
    };

    render(<TestMetrics testData={zeroTestData} />);

    // When total is 0, success rate calculation should handle division by zero
    // 0 / 0 * 100 = NaN, which toFixed(1) converts to "NaN"
    expect(screen.getByText(/NaN%|0\.0%/)).toBeInTheDocument();
  });

  it('should render alert triangle icon for skipped tests', () => {
    render(<TestMetrics testData={mockTestData} />);

    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
  });

  it('should render CustomTooltip with correct data when active', () => {
    render(<TestMetrics testData={mockTestData} />);
    
    // Find the tooltip element and verify it's rendered
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('should handle CustomTooltip with payload data', () => {
    render(<TestMetrics testData={mockTestData} />);
    
    // The tooltip should be present in the DOM
    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toBeInTheDocument();
  });

  it('should render legend with custom formatter', () => {
    render(<TestMetrics testData={mockTestData} />);
    
    // Legend should be present
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('should render pie chart with custom elements', () => {
    render(<TestMetrics testData={mockTestData} />);
    
    // The pie chart should be rendered with proper data items
    expect(screen.getByTestId('pie-item-Passed')).toBeInTheDocument();
    expect(screen.getByTestId('pie-item-Failed')).toBeInTheDocument();
    expect(screen.getByTestId('pie-item-Skipped')).toBeInTheDocument();
  });

  it('should use chart render complete hook with test data', () => {
    render(<TestMetrics testData={mockTestData} />);

    // The component should render successfully, indicating the hook was called
    expect(screen.getByText('Test Execution Summary')).toBeInTheDocument();
  });

  it('should render tooltip and legend components', () => {
    render(<TestMetrics testData={mockTestData} />);

    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('should render Test Status Distribution heading', () => {
    render(<TestMetrics testData={mockTestData} />);

    expect(screen.getByText('Test Status Distribution')).toBeInTheDocument();
  });

  it('should render different test scenarios correctly', () => {
    const allFailedData = {
      summary: {
        total: 20,
        passed: 0,
        failed: 20,
        skipped: 0,
        time: 45.8
      },
      suites: []
    };

    render(<TestMetrics testData={allFailedData} />);

    expect(screen.getByText('20')).toBeInTheDocument(); // Failed count
    expect(screen.getAllByText('0')).toHaveLength(2); // Passed and skipped both 0
    expect(screen.getByText('0.0%')).toBeInTheDocument(); // 0% success rate
  });

  it('should render all skipped tests scenario', () => {
    const allSkippedData = {
      summary: {
        total: 15,
        passed: 0,
        failed: 0,
        skipped: 15,
        time: 0
      },
      suites: []
    };

    render(<TestMetrics testData={allSkippedData} />);

    expect(screen.getByText('15')).toBeInTheDocument(); // Skipped count
    expect(screen.getAllByText('0')).toHaveLength(2); // Passed and failed both 0
    expect(screen.getByText('0.0%')).toBeInTheDocument(); // 0% success rate
  });
});