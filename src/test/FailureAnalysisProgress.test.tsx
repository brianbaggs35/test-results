import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FailureAnalysisProgress } from '../components/FailureAnalysis/FailureAnalysisProgress';

// Helper function to create test data with failed tests
function createTestDataWithFailures(numFailedTests: number) {
  const suites = [];
  const testsPerSuite = Math.min(20, Math.max(5, Math.floor(numFailedTests / 5)));
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
  FilterControls: ({ 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter,
    showFilters,
    setShowFilters,
    resetFilters,
    statusOptions 
  }: any) => (
    <div data-testid="filter-controls">
      <input 
        data-testid="search-input" 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search tests..."
      />
      <select 
        data-testid="status-filter" 
        value={statusFilter} 
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        {statusOptions?.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button data-testid="show-filters" onClick={() => setShowFilters(!showFilters)}>
        Filters
      </button>
      <button data-testid="reset-filters" onClick={resetFilters}>
        Reset
      </button>
    </div>
  ),
}));

describe('FailureAnalysisProgress', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Basic functionality', () => {
    it('should render progress overview for failed tests', () => {
      const testData = createTestDataWithFailures(25);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.getByText('Failure Resolution Progress')).toBeInTheDocument();
      expect(screen.getByText('Total Failed Tests')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument(); // Total count
      expect(screen.getByText('25 tests tracked')).toBeInTheDocument();
    });

    it('should show filter controls', () => {
      const testData = createTestDataWithFailures(10);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.getByTestId('filter-controls')).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    });

    it('should show custom status options for progress tracking', () => {
      const testData = createTestDataWithFailures(5);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      const statusFilter = screen.getByTestId('status-filter');
      expect(statusFilter).toBeInTheDocument();
      
      // Check that custom status options are available
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getAllByText('In Progress')).toHaveLength(2); // One in overview, one in filter
      expect(screen.getAllByText('Completed')).toHaveLength(2); // One in overview, one in filter
    });
  });

  describe('Pagination', () => {
    it('should show pagination controls when there are more than 50 tests', () => {
      const testData = createTestDataWithFailures(75);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.getByText('Showing 1 to 50 of 75 results')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('(Showing 1-50 of 75)')).toBeInTheDocument();
    });

    it('should not show pagination controls when there are 50 or fewer tests', () => {
      const testData = createTestDataWithFailures(25);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Showing 1 to')).not.toBeInTheDocument();
    });

    it('should navigate to next page when Next button is clicked', () => {
      const testData = createTestDataWithFailures(75);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Showing 51 to 75 of 75 results')).toBeInTheDocument();
    });

    it('should handle large datasets (1000+ tests)', () => {
      const testData = createTestDataWithFailures(1000);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.getByText('1000 tests tracked')).toBeInTheDocument();
      expect(screen.getByText('Showing 1 to 50 of 1000 results')).toBeInTheDocument();
      expect(screen.getByText('(Showing 1-50 of 1000)')).toBeInTheDocument();
    });
  });

  describe('Search and Filter', () => {
    it('should filter tests by search term', () => {
      const testData = createTestDataWithFailures(10);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'test0_0' } });
      
      // Should show fewer results after search
      expect(screen.getByText('1 test tracked')).toBeInTheDocument();
    });

    it('should reset filters when reset button is clicked', () => {
      const testData = createTestDataWithFailures(10);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      // Apply a search filter
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'test0_0' } });
      
      expect(screen.getByText('1 test tracked')).toBeInTheDocument();
      
      // Reset filters
      const resetButton = screen.getByTestId('reset-filters');
      fireEvent.click(resetButton);
      
      expect(screen.getByText('10 tests tracked')).toBeInTheDocument();
    });
  });

  describe('Bulk Actions', () => {
    it('should show bulk action controls', () => {
      const testData = createTestDataWithFailures(5);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      // Should show Select All checkbox
      expect(screen.getByText('Select All (0 selected)')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /select all/i })).toBeInTheDocument();
    });

    it('should select and deselect individual tests', () => {
      const testData = createTestDataWithFailures(3);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      // Get all individual checkboxes (excluding the "Select All" checkbox)
      const checkboxes = screen.getAllByRole('checkbox');
      const testCheckboxes = checkboxes.slice(1); // Skip the "Select All" checkbox
      
      expect(testCheckboxes).toHaveLength(3);
      
      // Select first test
      fireEvent.click(testCheckboxes[0]);
      expect(screen.getByText('Select All (1 selected)')).toBeInTheDocument();
      
      // Select second test
      fireEvent.click(testCheckboxes[1]);
      expect(screen.getByText('Select All (2 selected)')).toBeInTheDocument();
      
      // Deselect first test
      fireEvent.click(testCheckboxes[0]);
      expect(screen.getByText('Select All (1 selected)')).toBeInTheDocument();
    });

    it('should select and deselect all tests', () => {
      const testData = createTestDataWithFailures(3);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      
      // Select all tests
      fireEvent.click(selectAllCheckbox);
      expect(screen.getByText('Select All (3 selected)')).toBeInTheDocument();
      expect(selectAllCheckbox).toBeChecked();
      
      // Deselect all tests
      fireEvent.click(selectAllCheckbox);
      expect(screen.getByText('Select All (0 selected)')).toBeInTheDocument();
      expect(selectAllCheckbox).not.toBeChecked();
    });

    it('should show bulk action buttons when tests are selected', () => {
      const testData = createTestDataWithFailures(3);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      // Initially should not show bulk action buttons
      expect(screen.queryByText('Bulk Actions:')).not.toBeInTheDocument();
      
      // Select a test
      const checkboxes = screen.getAllByRole('checkbox');
      const testCheckbox = checkboxes[1]; // First test checkbox (skip Select All)
      fireEvent.click(testCheckbox);
      
      // Should now show bulk action buttons
      expect(screen.getByText('Bulk Actions:')).toBeInTheDocument();
      expect(screen.getByText('Mark as Pending')).toBeInTheDocument();
      expect(screen.getByText('Mark as In Progress')).toBeInTheDocument();
      expect(screen.getByText('Mark as Complete')).toBeInTheDocument();
    });

    it('should perform bulk status updates', () => {
      const testData = createTestDataWithFailures(3);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      // Select all tests
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      fireEvent.click(selectAllCheckbox);
      
      // Verify tests are selected
      expect(screen.getByText('Select All (3 selected)')).toBeInTheDocument();
      
      // Click "Mark as In Progress"
      const inProgressButton = screen.getByText('Mark as In Progress');
      fireEvent.click(inProgressButton);
      
      // Should clear selection after bulk update
      expect(screen.getByText('Select All (0 selected)')).toBeInTheDocument();
      
      // Bulk actions should be hidden since no tests are selected
      expect(screen.queryByText('Bulk Actions:')).not.toBeInTheDocument();
    });

    it('should clear selection after bulk update', () => {
      const testData = createTestDataWithFailures(2);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      // Select all tests
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      fireEvent.click(selectAllCheckbox);
      expect(screen.getByText('Select All (2 selected)')).toBeInTheDocument();
      
      // Perform bulk update
      const completeButton = screen.getByText('Mark as Complete');
      fireEvent.click(completeButton);
      
      // Selection should be cleared
      expect(screen.getByText('Select All (0 selected)')).toBeInTheDocument();
      expect(screen.queryByText('Bulk Actions:')).not.toBeInTheDocument();
    });
  });
});