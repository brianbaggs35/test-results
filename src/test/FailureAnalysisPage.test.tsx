import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FailureAnalysisPage } from '../components/FailureAnalysis/FailureAnalysisPage';

// Mock child components
vi.mock('../components/Dashboard/TestDetailsModal', () => ({
  TestDetailsModal: ({ test, onClose }: any) => (
    <div data-testid="test-details-modal">
      <div>Test: {test?.name}</div>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../components/Dashboard/FilterControls', () => ({
  FilterControls: ({ searchTerm, setSearchTerm, resetFilters, showFilters }: any) => (
    <div data-testid="filter-controls">
      <input
        data-testid="search-input"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search tests..."
      />
      <button data-testid="reset-filters" onClick={resetFilters}>
        Reset Filters
      </button>
      <div>Show Filters: {showFilters ? 'true' : 'false'}</div>
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertTriangleIcon: () => <div data-testid="alert-triangle-icon" />,
  ClockIcon: () => <div data-testid="clock-icon" />,
  SearchIcon: () => <div data-testid="search-icon" />,
  FilterIcon: () => <div data-testid="filter-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />,
}));

describe('FailureAnalysisPage', () => {
  const mockTestData = {
    suites: [
      {
        name: 'Suite 1',
        testcases: [
          {
            name: 'test1',
            classname: 'Class1',
            status: 'failed',
            time: '1.5',
            errorMessage: 'Test failed',
            failureDetails: {
              message: 'Assertion error',
              type: 'AssertionError',
              stackTrace: 'Stack trace here'
            }
          },
          {
            name: 'test2',
            classname: 'Class2',
            status: 'passed',
            time: '0.8',
          }
        ]
      },
      {
        name: 'Suite 2',
        testcases: [
          {
            name: 'test3',
            classname: 'Class3',
            status: 'failed',
            time: '2.1',
            errorMessage: 'Another failure'
          }
        ]
      }
    ]
  };

  it('should show no data message when testData is null', () => {
    render(<FailureAnalysisPage testData={null} />);

    expect(screen.getByText('No Test Data Available')).toBeInTheDocument();
    expect(screen.getByText('Please upload a JUnit XML file from the Dashboard to view failure analysis.')).toBeInTheDocument();
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
  });

  it('should show no data message when testData is undefined', () => {
    render(<FailureAnalysisPage testData={undefined} />);

    expect(screen.getByText('No Test Data Available')).toBeInTheDocument();
  });

  it('should render failure analysis when test data is available', () => {
    render(<FailureAnalysisPage testData={mockTestData} />);

    expect(screen.getByText('Failure Analysis')).toBeInTheDocument();
    expect(screen.getByTestId('filter-controls')).toBeInTheDocument();
  });

  it('should display failed tests count correctly', () => {
    render(<FailureAnalysisPage testData={mockTestData} />);

    expect(screen.getByText('2 failed tests detected')).toBeInTheDocument();
  });

  it('should display failed test details', () => {
    render(<FailureAnalysisPage testData={mockTestData} />);

    expect(screen.getByText('test1')).toBeInTheDocument();
    expect(screen.getByText('test3')).toBeInTheDocument();
    expect(screen.getByText('Suite: Suite 1')).toBeInTheDocument();
    expect(screen.getByText('Suite: Suite 2')).toBeInTheDocument();
  });

  it('should display execution time for failed tests', () => {
    render(<FailureAnalysisPage testData={mockTestData} />);

    expect(screen.getByText('1.50s')).toBeInTheDocument();
    expect(screen.getByText('2.10s')).toBeInTheDocument();
  });

  it('should filter tests by search term', () => {
    render(<FailureAnalysisPage testData={mockTestData} />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'test1' } });

    expect(screen.getByText('test1')).toBeInTheDocument();
    expect(screen.queryByText('test3')).not.toBeInTheDocument();
  });

  it('should filter tests by suite name in search', () => {
    render(<FailureAnalysisPage testData={mockTestData} />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Suite 2' } });

    expect(screen.getByText('test3')).toBeInTheDocument();
    expect(screen.queryByText('test1')).not.toBeInTheDocument();
  });

  it('should reset filters when reset button is clicked', () => {
    render(<FailureAnalysisPage testData={mockTestData} />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'test1' } });

    const resetButton = screen.getByTestId('reset-filters');
    fireEvent.click(resetButton);

    expect(searchInput.value).toBe('');
  });

  it('should open test details modal when test is clicked', () => {
    render(<FailureAnalysisPage testData={mockTestData} />);

    const testButton = screen.getByText('test1').closest('button');
    fireEvent.click(testButton);

    expect(screen.getByTestId('test-details-modal')).toBeInTheDocument();
    expect(screen.getByText('Test: test1')).toBeInTheDocument();
  });

  it('should close test details modal when close button is clicked', () => {
    render(<FailureAnalysisPage testData={mockTestData} />);

    // Open modal
    const testButton = screen.getByText('test1').closest('button');
    fireEvent.click(testButton);

    // Close modal
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(screen.queryByTestId('test-details-modal')).not.toBeInTheDocument();
  });

  it('should show "All Tests Passed" when no failed tests', () => {
    const passedTestData = {
      suites: [
        {
          name: 'Suite 1',
          testcases: [
            {
              name: 'test1',
              classname: 'Class1',
              status: 'passed',
              time: '0.5',
            }
          ]
        }
      ]
    };

    render(<FailureAnalysisPage testData={passedTestData} />);

    expect(screen.getByText('All Tests Passed')).toBeInTheDocument();
    expect(screen.getByText('No failures were detected in this test run.')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('should handle empty test suites', () => {
    const emptyTestData = {
      suites: []
    };

    render(<FailureAnalysisPage testData={emptyTestData} />);

    expect(screen.getByText('All Tests Passed')).toBeInTheDocument();
  });

  it('should handle test data with no testcases', () => {
    const noTestCasesData = {
      suites: [
        {
          name: 'Empty Suite',
          testcases: []
        }
      ]
    };

    render(<FailureAnalysisPage testData={noTestCasesData} />);

    expect(screen.getByText('All Tests Passed')).toBeInTheDocument();
  });

  it('should display correct count for single failed test', () => {
    const singleFailureData = {
      suites: [
        {
          name: 'Suite 1',
          testcases: [
            {
              name: 'test1',
              classname: 'Class1',
              status: 'failed',
              time: '1.0',
              errorMessage: 'Test failed'
            }
          ]
        }
      ]
    };

    render(<FailureAnalysisPage testData={singleFailureData} />);

    expect(screen.getByText('1 failed test detected')).toBeInTheDocument();
  });
});