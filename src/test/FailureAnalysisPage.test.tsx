import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FailureAnalysisPage } from '../components/FailureAnalysis/FailureAnalysisPage';

// Helper function to create large test datasets
function createLargeTestData(numFailedTests: number) {
  const suites = [];
  const testsPerSuite = Math.min(100, Math.max(10, Math.floor(numFailedTests / 10))); // 10-100 tests per suite
  const numSuites = Math.ceil(numFailedTests / testsPerSuite);
  
  for (let suiteIndex = 0; suiteIndex < numSuites; suiteIndex++) {
    const suite = {
      name: `TestSuite${suiteIndex + 1}`,
      tests: 0,
      failures: 0,
      errors: 0,
      skipped: 0,
      time: 0,
      timestamp: `2024-01-01T12:0${suiteIndex}:00Z`,
      testcases: [] as any[]
    };
    
    const testsInThisSuite = Math.min(testsPerSuite, numFailedTests - (suiteIndex * testsPerSuite));
    
    for (let testIndex = 0; testIndex < testsInThisSuite; testIndex++) {
      const testTime = Math.random() * 5;
      suite.testcases.push({
        name: `test${suiteIndex}_${testIndex}`,
        classname: `Class${suiteIndex}_${testIndex}`,
        status: 'failed' as const,
        time: testTime,
        errorMessage: `Test failure ${suiteIndex}_${testIndex}`,
        failureDetails: {
          message: `Assertion error in test ${suiteIndex}_${testIndex}`,
          type: 'AssertionError',
          stackTrace: `Stack trace for test ${suiteIndex}_${testIndex}\n    at line 1\n    at line 2`
        }
      });
      suite.time += testTime;
      suite.failures++;
    }
    
    suite.tests = testsInThisSuite;
    suites.push(suite);
  }
  
  return { 
    summary: {
      total: numFailedTests,
      passed: 0,
      failed: numFailedTests,
      skipped: 0,
      time: suites.reduce((total, suite) => total + suite.time, 0)
    },
    suites 
  };
}

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
    summary: {
      total: 3,
      passed: 1,
      failed: 2,
      skipped: 0,
      time: 4.4
    },
    suites: [
      {
        name: 'Suite 1',
        tests: 2,
        failures: 1,
        errors: 0,
        skipped: 0,
        time: 2.3,
        timestamp: '2024-01-01T12:00:00Z',
        testcases: [
          {
            name: 'test1',
            classname: 'Class1',
            status: 'failed' as const,
            time: 1.5,
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
            status: 'passed' as const,
            time: 0.8,
          }
        ]
      },
      {
        name: 'Suite 2',
        tests: 1,
        failures: 1,
        errors: 0,
        skipped: 0,
        time: 2.1,
        timestamp: '2024-01-01T12:01:00Z',
        testcases: [
          {
            name: 'test3',
            classname: 'Class3',
            status: 'failed' as const,
            time: 2.1,
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
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
        time: 0.5
      },
      suites: [
        {
          name: 'Suite 1',
          tests: 1,
          failures: 0,
          errors: 0,
          skipped: 0,
          time: 0.5,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'test1',
              classname: 'Class1',
              status: 'passed' as const,
              time: 0.5,
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
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        time: 0
      },
      suites: []
    };

    render(<FailureAnalysisPage testData={emptyTestData} />);

    expect(screen.getByText('All Tests Passed')).toBeInTheDocument();
  });

  it('should handle test data with no testcases', () => {
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

    render(<FailureAnalysisPage testData={noTestCasesData} />);

    expect(screen.getByText('All Tests Passed')).toBeInTheDocument();
  });

  it('should display correct count for single failed test', () => {
    const singleFailureData = {
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        time: 1.0
      },
      suites: [
        {
          name: 'Suite 1',
          tests: 1,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 1.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'test1',
              classname: 'Class1',
              status: 'failed' as const,
              time: 1.0,
              errorMessage: 'Test failed'
            }
          ]
        }
      ]
    };

    render(<FailureAnalysisPage testData={singleFailureData} />);

    expect(screen.getByText('1 failed test detected')).toBeInTheDocument();
  });

  describe('Large dataset handling', () => {
    it('should handle 100 failed tests efficiently', () => {
      const largeTestData = createLargeTestData(100);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      expect(screen.getByText('100 failed tests detected')).toBeInTheDocument();
    });

    it('should handle 500 failed tests', () => {
      const largeTestData = createLargeTestData(500);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      expect(screen.getByText('500 failed tests detected')).toBeInTheDocument();
    });

    it('should handle 1000 failed tests', () => {
      const largeTestData = createLargeTestData(1000);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      expect(screen.getByText('1000 failed tests detected')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should show pagination controls when there are more than 50 tests', () => {
      const largeTestData = createLargeTestData(100);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      expect(screen.getByText('(Showing 1-50 of 100)')).toBeInTheDocument();
      expect(screen.getByText('Showing 1 to 50 of 100 results')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });

    it('should not show pagination controls when there are 50 or fewer tests', () => {
      const smallTestData = createLargeTestData(25);
      
      render(<FailureAnalysisPage testData={smallTestData} />);
      
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    });

    it('should navigate to next page when Next button is clicked', () => {
      const largeTestData = createLargeTestData(100);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Showing 51 to 100 of 100 results')).toBeInTheDocument();
      expect(screen.getByText('(Showing 51-100 of 100)')).toBeInTheDocument();
    });

    it('should navigate to previous page when Previous button is clicked', () => {
      const largeTestData = createLargeTestData(100);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      // Go to page 2 first
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      // Then go back to page 1
      const previousButton = screen.getByText('Previous');
      fireEvent.click(previousButton);
      
      expect(screen.getByText('Showing 1 to 50 of 100 results')).toBeInTheDocument();
      expect(screen.getByText('(Showing 1-50 of 100)')).toBeInTheDocument();
    });

    it('should disable Previous button on first page', () => {
      const largeTestData = createLargeTestData(100);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      const previousButton = screen.getByText('Previous');
      expect(previousButton).toBeDisabled();
    });

    it('should disable Next button on last page', () => {
      const largeTestData = createLargeTestData(100);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      // Go to page 2 (last page for 100 tests)
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(nextButton).toBeDisabled();
    });

    it('should reset to page 1 when filters are reset', () => {
      const largeTestData = createLargeTestData(100);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      // Go to page 2
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      // Reset filters
      const resetButton = screen.getByTestId('reset-filters');
      fireEvent.click(resetButton);
      
      expect(screen.getByText('Showing 1 to 50 of 100 results')).toBeInTheDocument();
    });

    it('should navigate using page number buttons', () => {
      const largeTestData = createLargeTestData(200);
      
      render(<FailureAnalysisPage testData={largeTestData} />);
      
      // Click on page 2 button
      const page2Button = screen.getByRole('button', { name: '2' });
      fireEvent.click(page2Button);
      
      expect(screen.getByText('Showing 51 to 100 of 200 results')).toBeInTheDocument();
    });
  });
});